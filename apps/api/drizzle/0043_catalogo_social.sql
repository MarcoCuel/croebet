-- Bind existing catalog records in place, keeping slug, image, enabled flag and audit identity.
UPDATE games AS g SET module_id=g.slug,version=version+1
WHERE g.slug IN ('coup','dixit','secret-hitler','spyfall') AND g.deleted_at IS NULL
AND g.module_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND NOT EXISTS (SELECT 1 FROM games other WHERE other.module_id=g.slug)
AND NOT EXISTS (SELECT 1 FROM game_matches history WHERE history.game_id=g.id AND history.game_slug<>g.slug);
--> statement-breakpoint
INSERT INTO games(slug,module_id,name,description,enabled,image_url,version,fallback_duration_minutes)
VALUES ('coup','coup','Coup','Blefe e desafie para conservar a última influência da corte.',true,null,1,15),
('dixit','dixit','Dixit','Conte uma história com imagens e descubra a escolha do narrador.',true,null,1,30),
('secret-hitler','secret-hitler','Secret Hitler','Forme governos e descubra as lealdades do parlamento.',true,null,1,40),
('spyfall','spyfall','Spyfall','Pergunte, deduza e descubra o espião antes que ele identifique o local.',true,null,1,40)
ON CONFLICT DO NOTHING;
