create sequence oauth_client_scopes_seq;

create table oauth_client_scopes (
	id INT NOT NULL DEFAULT NEXTVAL ('oauth_client_scopes_seq') PRIMARY KEY, 
	oauth_client_id INT NOT NULL, 
	scope VARCHAR (36) NOT NULL, 
	created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	updated_at TIMESTAMP(0) NULL, 
	constraint oauth_client_scopes_uindex UNIQUE (oauth_client_id),
	constraint oauth_client_scopes_oauth_clients_id_fk FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients (id) ON UPDATE CASCADE
);