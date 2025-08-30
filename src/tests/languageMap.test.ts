import { 
  getLanguageFromExtension, 
  getLanguageFromAlias, 
  getAllLanguages,
  getLanguageDefinition
} from '../utils';

console.log('Testing language mapping module...');

console.log('\nTesting getLanguageFromExtension:');
const extensionTests = [
  '.ts', '.js', '.py', '.go', '.rb', '.java', '.php', '.swift', 
  '.kt', '.scala', '.c', '.cpp', '.cs', '.rs', '.html', '.css',
  '.unknown'
];

extensionTests.forEach(ext => {
  console.log(`Extension ${ext} -> ${getLanguageFromExtension(ext)}`);
});

console.log('\nTesting getLanguageFromAlias:');
const aliasTests = [
  'typescript', 'js', 'python', 'golang', 'ruby', 'java', 
  'php', 'swift', 'kotlin', 'scala', 'c', 'cpp', 'csharp', 
  'rust', 'html', 'css', 'unknown'
];

aliasTests.forEach(alias => {
  console.log(`Alias ${alias} -> ${getLanguageFromAlias(alias)}`);
});

console.log('\nTesting getLanguageDefinition:');
const languageTests = ['TypeScript', 'JavaScript', 'Python', 'Unknown'];

languageTests.forEach(lang => {
  const def = getLanguageDefinition(lang);
  console.log(`Language ${lang} -> ${def ? `Found with ${def.extensions.length} extensions` : 'Not found'}`);
});

console.log('\nAll supported languages:');
const allLanguages = getAllLanguages();
console.log(`Total languages: ${allLanguages.length}`);
console.log(allLanguages.join(', '));
