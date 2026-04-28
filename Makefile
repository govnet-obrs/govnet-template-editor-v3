COMPOSE_FILE := gotenberg.compose.yaml
COMPOSE := docker compose -f $(COMPOSE_FILE)

.PHONY: up up-fresh down logs ps restart build rebuild-gotenberg

up:
	$(COMPOSE) up -d --build

up-fresh:
	$(COMPOSE) build --pull --no-cache
	$(COMPOSE) up -d --force-recreate

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

restart:
	$(COMPOSE) down
	$(COMPOSE) up -d --build

build:
	$(COMPOSE) build

rebuild-gotenberg:
	$(COMPOSE) build gotenberg
	$(COMPOSE) up -d gotenberg backend