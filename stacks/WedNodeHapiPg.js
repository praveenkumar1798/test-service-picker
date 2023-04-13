import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elasticloadbalancing from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as secretsManager from "aws-cdk-lib/aws-secretsmanager";
import {
	DatabaseInstance,
	DatabaseInstanceEngine,
	PostgresEngineVersion,
	Credentials,
} from "aws-cdk-lib/aws-rds";
import { CfnOutput } from "aws-cdk-lib";
import * as elasticcache from "aws-cdk-lib/aws-elasticache";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

export function WedNodeHapiPg({ stack }) {
	const clientName = "wed";
	const environment = "develop";
	const clientPrefix = `${clientName}-${environment}`;
	const dbName = "wed_database";
	const dbUsername = "username";

	const vpc = new ec2.Vpc(stack, `${clientPrefix}-vpc`, {
		maxAzs: 3,
		natGateways: 1,
		subnetConfiguration: [
			{
				name: "public-subnet",
				subnetType: ec2.SubnetType.PUBLIC,
				cidrMask: 24,
			},
			{
				cidrMask: 24,
				name: "private-subnet",
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
		],
	});

	// Load Balancer Security groups
	const elbSG = new ec2.SecurityGroup(stack, `${clientPrefix}-elbSG`, {
		vpc,
		allowAllOutbound: true,
	});

	elbSG.addIngressRule(
		ec2.Peer.anyIpv4(),
		ec2.Port.tcp(80),
		"Allow http traffic"
	);

	// ECS Security groups
	const ecsSG = new ec2.SecurityGroup(stack, `${clientPrefix}-ecsSG`, {
		vpc,
		allowAllOutbound: true,
	});

	ecsSG.connections.allowFrom(
		elbSG,
		ec2.Port.allTcp(),
		"Application load balancer"
	);

	// Database security group
	const databaseSecurityGroup = new ec2.SecurityGroup(
		stack,
		`${clientPrefix}-database-security-group`,
		{
			vpc,
			allowAllOutbound: false,
		}
	);

	databaseSecurityGroup.addIngressRule(
		ecsSG,
		ec2.Port.tcp(5432),
		"Permit the database to accept requests from the fargate service"
	);

	const databaseCredentialsSecret = new secretsManager.Secret(
		stack,
		`${clientPrefix}-database-credentials-secret`,
		{
			secretName: `${clientPrefix}-database-credentials`,
			description: `Database credentials for ${clientName}-develop`,
			generateSecretString: {
				excludeCharacters: "\"@/\\ '",
				generateStringKey: "password",
				passwordLength: 30,
				secretStringTemplate: JSON.stringify({ username: dbUsername }),
			},
		}
	);

	const databaseCredentials = Credentials.fromSecret(
		databaseCredentialsSecret,
		dbUsername
	);

	const database = new DatabaseInstance(
		stack,
		`${clientPrefix}-database-instance`,
		{
			vpc,
			securityGroups: [databaseSecurityGroup],
			credentials: databaseCredentials,
			engine: DatabaseInstanceEngine.postgres({
				version: PostgresEngineVersion.VER_14_2,
			}),
			removalPolicy: cdk.RemovalPolicy.DESTROY, // CHANGE TO .SNAPSHOT FOR PRODUCTION
			instanceType: ec2.InstanceType.of(
				ec2.InstanceClass.BURSTABLE3,
				ec2.InstanceSize.MICRO
			),
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
			backupRetention: cdk.Duration.days(1),
			allocatedStorage: 10,
			maxAllocatedStorage: 30,
			databaseName: dbName,
		}
	);

	// Elasticache
	const redisSubnetGroup = new elasticcache.CfnSubnetGroup(
		stack,
		`${clientPrefix}-redis-subnet-group`,
		{
			description: "Subnet group for the redis cluster",
			subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
			cacheSubnetGroupName: `${clientPrefix}-redis-subnet-group`,
		}
	);

	const redisSecurityGroup = new ec2.SecurityGroup(
		stack,
		`${clientPrefix}-redis-security-group`,
		{
			vpc,
			allowAllOutbound: true,
			description: "Security group for the redis cluster",
		}
	);

	redisSecurityGroup.addIngressRule(
		ecsSG,
		ec2.Port.tcp(6379),
		"Permit the redis cluster to accept requests from the fargate service"
	);

	const redisCache = new elasticcache.CfnCacheCluster(
		stack,
		`${clientPrefix}-redis-cache`,
		{
			engine: "redis",
			cacheNodeType: "cache.t3.micro",
			numCacheNodes: 1,
			clusterName: `${clientPrefix}-redis-cluster`,
			vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
			cacheSubnetGroupName: redisSubnetGroup.ref,
			engineVersion: "6.2",
		}
	);

	redisCache.addDependency(redisSubnetGroup);

	// Creating your ECS
	const cluster = new ecs.Cluster(stack, `${clientPrefix}-cluster`, {
		clusterName: `${clientPrefix}-cluster`,
		vpc,
	});

	// Creating your Load Balancer
	const elb = new elasticloadbalancing.ApplicationLoadBalancer(
		stack,
		`${clientPrefix}-elb`,
		{
			vpc,
			vpcSubnets: { subnets: vpc.publicSubnets },
			internetFacing: true,
			loadBalancerName: `${clientPrefix}-alb`,
		}
	);

	elb.addSecurityGroup(elbSG);

	// Creating your target group
	const targetGroupHttp = new elasticloadbalancing.ApplicationTargetGroup(
		stack,
		`${clientPrefix}-target`,
		{
			port: 80,
			vpc,
			protocol: elasticloadbalancing.ApplicationProtocol.HTTP,
			targetType: elasticloadbalancing.TargetType.IP,
		}
	);

	targetGroupHttp.configureHealthCheck({
		path: "/",
		protocol: elasticloadbalancing.Protocol.HTTP,
	});

	// Adding your listeners
	const listener = elb.addListener("Listener", {
		open: true,
		port: 80,
	});

	listener.addTargetGroups(`${clientPrefix}-tg`, {
		targetGroups: [targetGroupHttp],
	});

	const taskRole = new iam.Role(stack, `${clientPrefix}-task-role`, {
		assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
		roleName: `${clientPrefix}-task-role`,
		description: "Role that the api task definitions use to run the api code",
	});

	const taskDefinition = new ecs.TaskDefinition(stack, `${clientPrefix}-task`, {
		family: `${clientPrefix}-task`,
		compatibility: ecs.Compatibility.EC2_AND_FARGATE,
		cpu: "256",
		memoryMiB: "512",
		networkMode: ecs.NetworkMode.AWS_VPC,
		taskRole: taskRole,
	});

	const username = databaseCredentialsSecret
		.secretValueFromJson("username")
		.toString();
	const password = databaseCredentialsSecret
		.secretValueFromJson("password")
		.toString();

	const dbURI = `postgres://${username}:${password}@${database.dbInstanceEndpointAddress}/${dbName}`;

	const image = ecs.ContainerImage.fromAsset("wed-node-hapi-pg/", {
		exclude: ["node_modules", ".git"],
		platform: Platform.LINUX_AMD64,
		buildArgs: {
			ENVIRONMENT_NAME: "development",
		},
	});

	const container = taskDefinition.addContainer(`${clientPrefix}-container`, {
		image,
		memoryLimitMiB: 512,
		environment: {
			BUILD_NAME: "develop",
			ENVIRONMENT_NAME: "development",
			DB_URI: dbURI,
			POSTGRES_HOST: database.dbInstanceEndpointAddress,
			REDIS_HOST: redisCache.attrRedisEndpointAddress,
		},
		logging: ecs.LogDriver.awsLogs({
			streamPrefix: `${clientPrefix}-log-group`,
		}),
	});

	container.addPortMappings({ containerPort: 9000 });

	const service = new ecs.FargateService(stack, `${clientPrefix}-service`, {
		cluster,
		desiredCount: 1,
		taskDefinition,
		securityGroups: [ecsSG],
		assignPublicIp: true,
	});

	service.attachToApplicationTargetGroup(targetGroupHttp);

	new CfnOutput(stack, "database-host", {
		exportName: "database-host",
		value: database.dbInstanceEndpointAddress,
	});

	new CfnOutput(stack, "database-name", {
		exportName: "database-name",
		value: dbName,
	});

	new CfnOutput(stack, "redis-host", {
		exportName: "redis-host",
		value: redisCache.attrRedisEndpointAddress,
	});

	new CfnOutput(stack, "load-balancer-dns", {
		exportName: "load-balancer-dns",
		value: elb.loadBalancerDnsName,
	});

	new CfnOutput(stack, "aws-region", {
		exportName: "aws-region",
		value: stack.region,
	});

  new CfnOutput(stack, "elastic-container-registry-repo", {
    exportName: "elastic-container-registry-repo",
    value: stack.synthesizer.repositoryName,
  });

  new CfnOutput(stack, "image", {
    exportName: "image",
    value: container.imageName,
  });

  new CfnOutput(stack, "task-definition-arn", {
    exportName: "task-definition",
    value: taskDefinition.taskDefinitionArn,
  });

  new CfnOutput(stack, "task-role", {
    exportName: "task-role",
    value: taskRole.roleArn,
  });

  new CfnOutput(stack, "execution-role", {
    exportName: "execution-role",
    value: taskDefinition.executionRole.roleArn,
  });

  new CfnOutput(stack, "family", {
    exportName: "family",
    value: taskDefinition.family,
  });

  new CfnOutput(stack, "container-name", {
    exportName: "container-name",
    value: container.containerName,
  });

  new CfnOutput(stack, "container-port", {
    exportName: "container-port",
    value: container.containerPort.toString(),
  });

  new CfnOutput(stack, "log-driver", {
    exportName: "log-driver",
    value: JSON.stringify(container.logDriverConfig.logDriver),
  });

  new CfnOutput(stack, "log-driver-options", {
    exportName: "log-driver-options",
    value: JSON.stringify(container.logDriverConfig.options),
  });
}
