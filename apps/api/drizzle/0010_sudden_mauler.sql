CREATE TABLE "navigation_menus" (
	"location" text PRIMARY KEY NOT NULL,
	"items" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "menu_location_valid" CHECK ("navigation_menus"."location" in ('main','footer')),
	CONSTRAINT "menu_version_positive" CHECK ("navigation_menus"."version" > 0)
);

--> statement-breakpoint
-- Initial navigation only; publishing a page never inserts a menu item.
INSERT INTO navigation_menus (location,items) VALUES
('main','[{"id":"7befafd1-3028-4957-986d-ac912bf2eb7f","type":"fixed","target":"home","label":"Início","newTab":false},{"id":"11bada3f-f98a-486c-b5eb-c05bd02b85c4","type":"fixed","target":"games","label":"Jogos","newTab":false},{"id":"4704a8f1-8b5b-4394-a585-f887e9a73626","type":"fixed","target":"betting","label":"Apostas","newTab":false},{"id":"354bb585-270e-4608-bfe3-971efac49725","type":"fixed","target":"rankings","label":"Rankings","newTab":false},{"id":"130902ce-6176-4fcd-9894-1920ed00f57b","type":"fixed","target":"achievements","label":"Conquistas","newTab":false}]'::jsonb || coalesce((select jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','page','pageId',id,'label',title,'newTab',false)) from pages where slug='sobre'),'[]'::jsonb)),
('footer','[{"id":"0ee507ac-ad4e-4a88-91d2-68f5c07c82eb","type":"fixed","target":"games","label":"Jogos","newTab":false},{"id":"8772c727-6571-43f1-9077-4a8a7538a229","type":"fixed","target":"betting","label":"Apostas","newTab":false}]'::jsonb || coalesce((select jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','page','pageId',id,'label',title,'newTab',false)) from pages where slug='sobre'),'[]'::jsonb));
