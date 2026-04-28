COMPOSE_FILE := gotenberg.compose.yaml
COMPOSE := docker compose -f $(COMPOSE_FILE)

.PHONY: up down logs ps restart build rebuild-gotenberg

up:
	$(COMPOSE) up -d --build

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