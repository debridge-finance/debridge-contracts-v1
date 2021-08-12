
module.exports = {
    overrides: [
      {
        files: "*.sol",
        options: {
          bracketSpacing: false,
          printWidth: 100,
          tabWidth: 4,
          useTabs: false,
          singleQuote: false,
          explicitTypes: "always",
        },
      },
      {
        files: "*.js",
        options: {
          printWidth: 100,
          trailingComma: "es5",
        },
      },
    ],
  }
