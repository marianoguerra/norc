{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-22.05.tar.gz") {} }:

pkgs.mkShell {
	LOCALE_ARCHIVE_2_27 = "${pkgs.glibcLocales}/lib/locale/locale-archive";
	buildInputs = [
		pkgs.glibcLocales
		pkgs.nodejs
	];
	shellHook = ''
		export LC_ALL=en_US.UTF-8
		export PATH=$PWD/node_modules/.bin:$PATH
	'';
}
