INSERT INTO games(slug,module_id,name,description,enabled,image_url,version,fallback_duration_minutes)
VALUES('solo','solo','Solo','Livre-se das cartas antes dos outros. Versão clássica, em desenvolvimento.',true,null,1,10)
ON CONFLICT DO NOTHING;
