create sequence oauth_client_resources_seq;

create table oauth_client_resources (
	id INT NOT NULL PRIMARY KEY DEFAULT NEXTVAL ('oauth_client_resources_seq'), 
	oauth_client_id INT NOT NULL, 
	resource_type VARCHAR(36) NOT NULL, 
	resource_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at TIMESTAMP(0) NULL, 
	CONSTRAINT oauth_client_resources_oauth_client_id_resource_uindex UNIQUE (
		oauth_client_id, resource_type, resource_id
	), 
	CONSTRAINT oauth_client_resources_oauth_clients_id_fk FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients (id) ON UPDATE CASCADE
);

CREATE INDEX oauth_client_resources_resource_type ON oauth_client_resources(resource_type);
CREATE INDEX oauth_client_resources_resource_id ON oauth_client_resources(resource_id);