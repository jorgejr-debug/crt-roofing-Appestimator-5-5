import { readFileSync } from 'node:fs';
// Existing source-contract tests span handlers and rendered controls. Expand the
// extracted workspace at its call site so those assertions still cover both.
export function readAppSource() {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  return app.replace(/const (render\w+) = \(\) => <(\w+Workspace) workspace=\{\{[^\n]*?\}\} \/>;/g, (match, render, component) => {
    const module = readFileSync(new URL(`../src/${component}.jsx`, import.meta.url), 'utf8');
    const body = module.slice(module.indexOf('} = workspace;') + '} = workspace;'.length, module.lastIndexOf('}'));
    return `const ${render} = () => {${body}};`;
  });
}
