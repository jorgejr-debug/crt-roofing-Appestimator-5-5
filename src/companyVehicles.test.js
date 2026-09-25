import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCompanyVehicle, isMissingVehicleTable } from './companyVehicles.js';
test('vehicle names, unit numbers and plates survive save/reload normalization',()=>{
 const row=normalizeCompanyVehicle({id:'truck',vehicle_name:'Crew truck',unit_number:'7',license_plate:'test',vehicle_type:'diesel',mpg:12,active:true});
 assert.deepEqual(normalizeCompanyVehicle(JSON.parse(JSON.stringify(row))),row);
});
test('known vehicle identity repairs an older blank cache entry without inventing a custom vehicle name',()=>{
 const fallback={value:'known',label:'Existing configured truck',mpg:12};
 assert.equal(normalizeCompanyVehicle({id:'known',vehicleName:''},fallback).vehicleName,fallback.label);
 assert.equal(normalizeCompanyVehicle({id:'custom',vehicleName:''}).vehicleName,'');
 assert.equal(normalizeCompanyVehicle({id:'known',vehicleName:'Custom label'},fallback).vehicleName,'Custom label');
 assert.equal(normalizeCompanyVehicle({active:'false'}).active,false);
});
test('only an explicitly missing vehicle table invokes the optional-table fallback',()=>{
 assert.equal(isMissingVehicleTable({code:'PGRST205',message:"Could not find the table 'public.company_vehicles'"}),true);
 assert.equal(isMissingVehicleTable({code:'42501',message:'company_vehicles permission denied'}),false);
 assert.equal(isMissingVehicleTable({code:'PGRST205',message:'employees missing'}),false);
});
