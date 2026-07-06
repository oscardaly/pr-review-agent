.PHONY: setup demo feedback eval test typecheck docker-build docker-demo

setup:
	bun install
	@test -f .env || cp .env.example .env
	@echo "→ Edit .env with your model + LangSmith keys, then: make demo"

demo:
	bun run demo

feedback:
	bun run feedback

eval:
	bun run eval

test:
	bun test src

typecheck:
	bunx tsc --noEmit

docker-build:
	docker build -t pr-review-agent .

docker-demo:
	docker run --rm --env-file .env pr-review-agent
