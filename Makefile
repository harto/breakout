DEPLOYABLE_FILES = index.html breakout.js breakout.css analytics.js
BUILD_DIRECTORY = .build

.PHONY: default deploy clean

default: $(BUILD_DIRECTORY)

$(BUILD_DIRECTORY): $(DEPLOYABLE_FILES)
	mkdir -p $(BUILD_DIRECTORY)
	cp $(DEPLOYABLE_FILES) $(BUILD_DIRECTORY)

deploy: $(BUILD_DIRECTORY)
	./deploy.sh $(BUILD_DIRECTORY)

clean:
	rm -rf $(BUILD_DIRECTORY)
