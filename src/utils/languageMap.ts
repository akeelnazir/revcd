import path from "path";

export interface LanguageMapEntry {
  name: string;
  extensions: string[];
  aliases?: string[];
}

export const languageDefinitions: LanguageMapEntry[] = [
  {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    aliases: ['ts', 'typescript']
  },
  {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    aliases: ['js', 'javascript']
  },
  {
    name: 'Python',
    extensions: ['.py', '.pyw', '.pyc', '.pyd', '.pyo'],
    aliases: ['py', 'python']
  },
  {
    name: 'Go',
    extensions: ['.go'],
    aliases: ['golang']
  },
  {
    name: 'Markdown',
    extensions: ['.md', '.markdown'],
    aliases: ['md']
  },
  {
    name: 'Ruby',
    extensions: ['.rb', '.rbw'],
    aliases: ['ruby']
  },
  {
    name: 'Java',
    extensions: ['.java', '.class', '.jar'],
    aliases: ['java']
  },
  {
    name: 'PHP',
    extensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.phps'],
    aliases: ['php']
  },
  {
    name: 'Swift',
    extensions: ['.swift'],
    aliases: ['swift']
  },
  {
    name: 'Kotlin',
    extensions: ['.kt', '.kts'],
    aliases: ['kotlin']
  },
  {
    name: 'Scala',
    extensions: ['.scala', '.sc'],
    aliases: ['scala']
  },
  {
    name: 'Groovy',
    extensions: ['.groovy', '.gvy', '.gy', '.gsh'],
    aliases: ['groovy']
  },
  {
    name: 'C',
    extensions: ['.c', '.h'],
    aliases: ['c']
  },
  {
    name: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.h'],
    aliases: ['cpp', 'c++']
  },
  {
    name: 'C#',
    extensions: ['.cs'],
    aliases: ['csharp', 'c#']
  },
  {
    name: 'Rust',
    extensions: ['.rs', '.rlib'],
    aliases: ['rust']
  },
  {
    name: 'HTML',
    extensions: ['.html', '.htm', '.xhtml'],
    aliases: ['html']
  },
  {
    name: 'CSS',
    extensions: ['.css'],
    aliases: ['css']
  },
  {
    name: 'SCSS',
    extensions: ['.scss'],
    aliases: ['scss']
  },
  {
    name: 'LESS',
    extensions: ['.less'],
    aliases: ['less']
  },
  {
    name: 'XML',
    extensions: ['.xml', '.xsl', '.xsd', '.svg'],
    aliases: ['xml']
  },
  {
    name: 'JSON',
    extensions: ['.json'],
    aliases: ['json']
  },
  {
    name: 'YAML',
    extensions: ['.yaml', '.yml'],
    aliases: ['yaml', 'yml']
  },
  {
    name: 'Shell',
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    aliases: ['sh', 'shell', 'bash']
  },
  {
    name: 'PowerShell',
    extensions: ['.ps1', '.psm1', '.psd1'],
    aliases: ['powershell', 'ps']
  },
  {
    name: 'SQL',
    extensions: ['.sql'],
    aliases: ['sql']
  },
  {
    name: 'Perl',
    extensions: ['.pl', '.pm', '.t'],
    aliases: ['perl']
  },
  {
    name: 'Lua',
    extensions: ['.lua'],
    aliases: ['lua']
  },
  {
    name: 'Dart',
    extensions: ['.dart'],
    aliases: ['dart']
  },
  {
    name: 'Elixir',
    extensions: ['.ex', '.exs'],
    aliases: ['elixir']
  },
  {
    name: 'Erlang',
    extensions: ['.erl', '.hrl'],
    aliases: ['erlang']
  },
  {
    name: 'Haskell',
    extensions: ['.hs', '.lhs'],
    aliases: ['haskell']
  },
  {
    name: 'R',
    extensions: ['.r', '.R'],
    aliases: ['r']
  },
  {
    name: 'Julia',
    extensions: ['.jl'],
    aliases: ['julia']
  },
  {
    name: 'Clojure',
    extensions: ['.clj', '.cljs', '.cljc', '.edn'],
    aliases: ['clojure']
  },
  {
    name: 'F#',
    extensions: ['.fs', '.fsi', '.fsx', '.fsscript'],
    aliases: ['fsharp', 'f#']
  },
  {
    name: 'OCaml',
    extensions: ['.ml', '.mli'],
    aliases: ['ocaml']
  },
  {
    name: 'Objective-C',
    extensions: ['.m', '.mm'],
    aliases: ['objc', 'objective-c']
  },
  {
    name: 'Assembly',
    extensions: ['.asm', '.s', '.S'],
    aliases: ['asm', 'assembly']
  },
  {
    name: 'TOML',
    extensions: ['.toml'],
    aliases: ['toml']
  },
  {
    name: 'Docker',
    extensions: ['.dockerfile', '.Dockerfile'],
    aliases: ['docker', 'dockerfile']
  }
];

export const extensionToLanguage: Map<string, string> = new Map();
export const languageNameMap: Map<string, LanguageMapEntry> = new Map();
export const aliasToLanguage: Map<string, string> = new Map();

languageDefinitions.forEach(lang => {
  languageNameMap.set(lang.name.toLowerCase(), lang);
  lang.extensions.forEach(ext => {
    extensionToLanguage.set(ext.toLowerCase(), lang.name);
  });
  if (lang.aliases) {
    lang.aliases.forEach(alias => {
      aliasToLanguage.set(alias.toLowerCase(), lang.name);
    });
  }
});

export function getFileLanguageFromPath(filePath: string): string {
    if (!filePath) {
      return 'Unknown';
    }
    const fileBaseName = path.basename(filePath);
    const fileExtension = path.extname(fileBaseName).toLowerCase();
    
    return getLanguageFromExtension(fileExtension);
  }

export function getLanguageFromExtension(extension: string): string {
  const normalizedExt = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return extensionToLanguage.get(normalizedExt) || 'Unknown';
}

export function getLanguageFromAlias(alias: string): string {
  return aliasToLanguage.get(alias.toLowerCase()) || 'Unknown';
}

export function getLanguageDefinition(name: string): LanguageMapEntry | undefined {
  return languageNameMap.get(name.toLowerCase());
}

export function getAllLanguages(): string[] {
  return Array.from(languageNameMap.keys()).map(key => {
    const entry = languageNameMap.get(key);
    return entry ? entry.name : key;
  });
}
