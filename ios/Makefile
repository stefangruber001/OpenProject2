# Canei Subirats iOS — one-command release.
#
#   make setup    → install fastlane + create fastlane/.env.default to fill once
#   make ship     → build a signed release and upload it to TestFlight
#   make build    → build a signed .ipa locally (no upload)
#   make open     → open the Xcode project
#
# After `make setup`, fill fastlane/.env.default (4 values), then just `make ship`.

.PHONY: setup ship build open

setup:
	@command -v bundle >/dev/null 2>&1 || gem install bundler
	bundle install
	@test -f fastlane/.env.default || cp fastlane/.env.example fastlane/.env.default
	@echo ""
	@echo "▸ Now open  ios/fastlane/.env.default  and paste your 4 values."
	@echo "▸ Then run:  make ship"

ship:
	bundle exec fastlane beta

build:
	bundle exec fastlane build_only

open:
	open CaneiSubirats.xcodeproj
