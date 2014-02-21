DEPLOYABLE_FILES = index.html breakout.js breakout.css analytics.js

.PHONY: default deploy

default:
	true

deploy: $(DEPLOYABLE_FILES)
	./deploy.sh $(DEPLOYABLE_FILES)
