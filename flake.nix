{
  description = "Nix development environment for Frontend";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system: 
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        
      in
      {
        devShells.default = pkgs.mkShellNoCC {
          name = "Sudokuru";
          buildInputs = with pkgs; [
            git
            jq
            pre-commit
            nodejs_26
            bun
            cargo
            rustc
            gh
          ];

          shellHook = ''
            ${pkgs.lib.optionalString pkgs.stdenv.isDarwin ''
              # Xcode treats matching environment variables as build settings.
              # In particular, LD=ld sends clang's -Xlinker arguments directly
              # to ld64 and fails with: -objc_abi_version '-Xlinker' expected 2.
              # mkShellNoCC avoids adding a compiler, but does not protect us
              # from overrides inherited from a parent shell or environment.
              unset CC CXX CPP OBJC OBJCXX LD LDPLUSPLUS AR AS NM RANLIB STRIP
              unset CFLAGS CXXFLAGS CPPFLAGS OBJCFLAGS OBJCXXFLAGS LDFLAGS
              unset SDKROOT MACOSX_DEPLOYMENT_TARGET IPHONEOS_DEPLOYMENT_TARGET
              unset TVOS_DEPLOYMENT_TARGET WATCHOS_DEPLOYMENT_TARGET XROS_DEPLOYMENT_TARGET
              unset NIX_CFLAGS_COMPILE NIX_CFLAGS_LINK NIX_LDFLAGS
              # Keep DEVELOPER_DIR: selecting an installed Xcode is intentional.
            ''}
            echo "⚡ Pinned NixOS 26.05 Development Environment Activated ⚡"
            export EXPO_LAN_ROOT=$(pwd)
            pre-commit install
            stools() {
              echo "Available tools: $(git --version), $(jq --version), node $(node --version), npm $(npm --version), $(pre-commit --version), bun $(bun --version), $(cargo --version), $(rustc --version), $(gh --version)"
            }
            stools
            export PS1="(\w) $PS1"
          '';
        };
      });
}
