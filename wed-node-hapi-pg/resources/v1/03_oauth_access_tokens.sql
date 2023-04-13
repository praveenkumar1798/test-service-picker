create sequence oauth_access_tokens_seq;

CREATE OR REPLACE FUNCTION public.is_json_valid(json_data json)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
	json_type TEXT;
BEGIN
	json_type := json_typeof(json_data);
	IF json_type = 'array' AND json_array_length(json_data) > 0 THEN
		RETURN TRUE;
	ELSIF json_type = 'object' AND json_data::text <> '{}'::TEXT THEN
		RETURN TRUE;
	END IF;
	RETURN FALSE;
END;
$function$;

create table oauth_access_tokens (
	id INT NOT NULL PRIMARY KEY DEFAULT NEXTVAL ('oauth_access_tokens_seq'), 
	oauth_client_id INT NOT NULL, 
	access_token VARCHAR(64) NOT NULL, 
	expires_in INTEGER CHECK (expires_in > 0) NOT NULL, 
	expires_on TIMESTAMP(0) NOT NULL, 
	metadata JSON NOT NULL, 
	created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at TIMESTAMP(0) NULL, 
	CONSTRAINT oauth_access_tokens_access_token_uindex UNIQUE (access_token), 
	CONSTRAINT oauth_access_tokens_oauth_clients_id_fk FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients (id) ON UPDATE CASCADE,
	CONSTRAINT oauth_access_tokens_check_metadata CHECK(is_json_valid(metadata))
);