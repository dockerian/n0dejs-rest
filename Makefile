# Makefile for n0dejs-api

IMG_NAME := n0dejs-api
ORG_NAME := dockerian

build:
	docker build -t $(IMG_NAME) .

start:
	docker rm -f -v $(IMG_NAME)
	./tools/start.sh rest

pretest:
	gulp lint-and-beautify

posttest:
	node ./node_modules/istanbul/lib/cli.js check-coverage

test:
	node ./node_modules/istanbul/lib/cli.js cover _mocha

test-only:
	node ./node_modules/istanbul/lib/cli.js cover _mocha

jsdoc:
	jsdoc app config tasks -r -d build/jsdoc

watch:
	node ./node_modules/gulp/bin/gulp.js watch
