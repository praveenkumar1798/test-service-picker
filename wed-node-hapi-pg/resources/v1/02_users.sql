CREATE SEQUENCE users_seq;

CREATE TABLE users 
	( 
		id              INT NOT NULL DEFAULT NEXTVAL ('users_seq') PRIMARY KEY, 
		oauth_client_id INT NOT NULL, 
		first_name      VARCHAR (32) NOT NULL, 
		last_name       VARCHAR(32) NOT NULL, 
		email           VARCHAR(32) NOT NULL, 
		created_at      TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP NOT NULL, 
		CONSTRAINT users_oauth_clients_id_fk FOREIGN KEY (oauth_client_id) 
		REFERENCES oauth_clients (id) ON UPDATE CASCADE 
	);