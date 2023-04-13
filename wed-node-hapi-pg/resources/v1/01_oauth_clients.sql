create sequence oauth_clients_seq;

create type grant_type_enum as ENUM('CLIENT_CREDENTIALS');

create table oauth_clients (
	id INT NOT NULL PRIMARY KEY DEFAULT NEXTVAL ('oauth_clients_seq'), 
	client_id VARCHAR(320) NOT NULL, 
	client_secret VARCHAR(36) NOT NULL, 
	grant_type grant_type_enum, 
	created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at TIMESTAMP(0) NULL,
	CONSTRAINT oauth_clients_client_id UNIQUE (client_id)
);

CREATE INDEX oauth_clients_client_id_idx ON oauth_clients(client_id);
CREATE INDEX oauth_clients_client_secret_idx ON oauth_clients(client_secret);