import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./App.jsx',import.meta.url),'utf8');
test('all eight large operational screens have real dynamic imports and pass their existing dependencies',()=>{
 for(const name of ['CfoDashboardWorkspace','CrmWorkspace','ActiveJobsWorkspace','ActiveJobWorkspace','FieldOperationsWorkspace','ApprovedJobsWorkspace','ApprovedJobWorkspace','AdministrationWorkspace']){
  assert.ok(source.includes(`const ${name} = React.lazy(() => import("./${name}.jsx"));`));
  assert.ok(source.includes(`<${name} workspace={{`));
  const module=readFileSync(new URL(`./${name}.jsx`,import.meta.url),'utf8');
  assert.ok(module.includes(`export default function ${name}({ workspace })`));
  assert.ok(module.includes('} = workspace;'));
 }
});
