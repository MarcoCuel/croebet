CREATE TABLE "achievement_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"metric" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "achievement_metric_valid" CHECK ("achievement_definitions"."metric" in ('games','wins','dailyDays','dailyStreak','coupons','losingGames')),
	CONSTRAINT "achievement_definition_valid" CHECK (char_length("achievement_definitions"."name") between 1 and 80 and "achievement_definitions"."sort_order" >= 0 and "achievement_definitions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "achievement_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"achievement_id" uuid NOT NULL,
	"target" bigint NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "achievement_level_valid" CHECK ("achievement_levels"."target" between 1 and 9007199254740991 and char_length("achievement_levels"."description") between 1 and 240)
);
--> statement-breakpoint
CREATE TABLE "achievement_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_achievement_id_achievement_definitions_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_level_id_achievement_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."achievement_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievement_level_target_unique" ON "achievement_levels" USING btree ("achievement_id","target");--> statement-breakpoint
CREATE UNIQUE INDEX "achievement_unlock_once" ON "achievement_unlocks" USING btree ("user_id","level_id");--> statement-breakpoint
CREATE INDEX "achievement_unlock_level_idx" ON "achievement_unlocks" USING btree ("level_id");
--> statement-breakpoint
-- Initial editable catalog; no account, balance or game history is changed.
INSERT INTO achievement_definitions(id,name,icon,metric,sort_order) VALUES ('d6693ffb-c6e4-513d-9af0-69f51982bdde','Só mais uma','playing-cards','games',0);
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('7e3d42b7-07fb-5a85-b45e-b5acc065f53d','d6693ffb-c6e4-513d-9af0-69f51982bdde',1,'Complete sua primeira partida.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('d1289365-2815-56aa-a2b5-fb3342d7eda8','d6693ffb-c6e4-513d-9af0-69f51982bdde',25,'Complete 25 partidas.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('71545dbe-c8c1-5955-a9c4-41f8a2c8517f','d6693ffb-c6e4-513d-9af0-69f51982bdde',100,'Complete 100 partidas.');
INSERT INTO achievement_definitions(id,name,icon,metric,sort_order) VALUES ('b5059697-8714-5829-a5bf-65d320098342','Foi habilidade','trophy','wins',1);
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('ce23d9d6-efb5-5850-ae63-417635996d7f','b5059697-8714-5829-a5bf-65d320098342',1,'Vença sua primeira partida.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('d5cb856f-c267-5f33-adee-d1163279cffc','b5059697-8714-5829-a5bf-65d320098342',10,'Vença 10 partidas.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('04aa1b46-bb3b-533a-8c64-0f890e5077d0','b5059697-8714-5829-a5bf-65d320098342',50,'Vença 50 partidas.');
INSERT INTO achievement_definitions(id,name,icon,metric,sort_order) VALUES ('ce4e4e91-8464-5da3-adab-5b617bf95a41','Presença marcada','flame','dailyDays',2);
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('3369cc33-bb38-53c9-8a52-5733b45e14af','ce4e4e91-8464-5da3-adab-5b617bf95a41',3,'Resgate o bônus em 3 dias diferentes.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('60780867-e164-584a-8df7-a18da2af342f','ce4e4e91-8464-5da3-adab-5b617bf95a41',15,'Resgate o bônus em 15 dias diferentes.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('adf5e70b-bc17-5cec-b46a-3caffc1a7e4b','ce4e4e91-8464-5da3-adab-5b617bf95a41',50,'Resgate o bônus em 50 dias diferentes.');
INSERT INTO achievement_definitions(id,name,icon,metric,sort_order) VALUES ('e1bb44e6-b29c-5323-bb48-26a93fa00de2','Volto amanhã','calendar-days','dailyStreak',3);
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('53501153-6c83-56df-9ad2-173cf696ae95','e1bb44e6-b29c-5323-bb48-26a93fa00de2',3,'Resgate o bônus por 3 dias seguidos.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('dbf5098d-ff68-577a-a518-fe83b156acda','e1bb44e6-b29c-5323-bb48-26a93fa00de2',7,'Resgate o bônus por 7 dias seguidos.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('3d19e954-abef-5ac8-8a83-ae28f6846302','e1bb44e6-b29c-5323-bb48-26a93fa00de2',30,'Resgate o bônus por 30 dias seguidos.');
INSERT INTO achievement_definitions(id,name,icon,metric,sort_order) VALUES ('1b9798fb-b4e6-5f97-abe5-f2b967ff1af0','Cupom não é salário','ticket','coupons',4);
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('b0ea5fca-5c95-554b-ae2c-34dfa41a8671','1b9798fb-b4e6-5f97-abe5-f2b967ff1af0',1,'Resgate seu primeiro cupom.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('f1b0da7e-05a8-5935-b4a2-847c6eb62bf4','1b9798fb-b4e6-5f97-abe5-f2b967ff1af0',5,'Resgate 5 cupons.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('0f3c07d0-43d8-5baf-95d7-93377c9c5dd8','1b9798fb-b4e6-5f97-abe5-f2b967ff1af0',20,'Resgate 20 cupons.');
INSERT INTO achievement_definitions(id,name,icon,metric,sort_order) VALUES ('177a12a9-0f40-5ef2-8489-2667d58b9a0e','A casa agradece','coins','losingGames',5);
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('803fac04-531d-5d9b-8b9a-b867be5fc357','177a12a9-0f40-5ef2-8489-2667d58b9a0e',1,'Termine uma partida com prejuízo em Croins.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('17e76113-1161-56cc-8dd4-b188564dd08e','177a12a9-0f40-5ef2-8489-2667d58b9a0e',10,'Termine 10 partidas com prejuízo em Croins.');
INSERT INTO achievement_levels(id,achievement_id,target,description) VALUES ('c7a001d1-97da-5c2a-baba-2e6785ba120f','177a12a9-0f40-5ef2-8489-2667d58b9a0e',50,'Termine 50 partidas com prejuízo em Croins.');
