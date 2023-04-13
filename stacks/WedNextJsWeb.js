import { StaticSite } from "sst/constructs";

	export function WedNextJsWeb({ stack }) {
		const bucketprefix = "wed-next-js-web";
		const environment = "develop";
		const bucketName = `${bucketprefix}-${environment}`;
	
		// Deploy our web app
		const site = new StaticSite(stack, "WedNextJsWebSite", {
			path: "wed-next-js-web",
			buildCommand: "yarn run build:dev",
			buildOutput: "out",
			cdk: {
				bucket: {
					bucketName,
				},
				distribution: {
					comment: `Distribution for ${bucketName}`,
				},
			},
		});
	
		// Show the URLs in the output
		stack.addOutputs({
			SiteUrl: site.url || "http://localhost:3000/",
			distributionId: site.cdk?.distribution?.distributionId,
			bucketName: site.cdk?.bucket?.bucketName,
		});
	}
