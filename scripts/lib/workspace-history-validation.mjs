/** Pure history validation, shared without importing config or filesystem modules. */
export function workspaceHistoryValidation({workspaceConfigDigest,workspaceTierDefinition}) {
  function meaningful(value) {
    return typeof value==='string' && value.trim().length>0;
  }

  function validRecord(record) {
    if(!record || typeof record!=='object' || Array.isArray(record)) {
      throw new Error('Malformed workspace history record');
    }
    if(!['proposal','acceptance','change'].includes(record.kind)) {
      throw new Error('Unknown workspace history record kind');
    }
    if(!/^[a-f0-9]{64}$/.test(record.digest)) throw new Error('Malformed workspace history digest');
    if(!Number.isInteger(record.revision) || record.revision<1) {
      throw new Error('Malformed workspace history revision');
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || Number.isNaN(Date.parse(record.date))) {
      throw new Error('Malformed workspace history date');
    }
    if(Object.hasOwn(record,'definition') && (!record.definition || !Number.isInteger(record.definition.version) || record.definition.version<1 || !/^[a-f0-9]{64}$/.test(record.definition.digest))) {
      throw new Error('Malformed workspace definition provenance');
    }
    if(record.kind==='proposal') {
      if(!record.config || !record.reasons || typeof record.reasons!=='object') {
        throw new Error('Malformed workspace proposal');
      }
    } else if(!meaningful(record.by) || !meaningful(record.reason) || !Array.isArray(record.changes)) {
      throw new Error('Malformed workspace acceptance');
    }
    return record;
  }

  function assertDefinitionProvenance(record,config) {
    const definition=workspaceTierDefinition(config);
    if(!definition) {
      if(Object.hasOwn(record,'definition')) throw new Error('Legacy workspace policy cannot claim tier definition provenance');
      return;
    }
    if(!record.definition || record.definition.version!==definition.version || record.definition.digest!==definition.digest) {
      throw new Error('Workspace tier definition provenance is invalid or stale');
    }
  }

  function validateHistory(records) {
    if(!records.length) return records;
    const first=records[0];
    if(first.kind!=='proposal' || first.revision!==1) throw new Error('Workspace history requires an initial proposal at revision 1');
    if(workspaceConfigDigest(first.config)!==first.digest) throw new Error('Workspace history proposal digest does not match its snapshot');
    assertDefinitionProvenance(first,first.config);
    for(let index=1;index<records.length;index+=1) {
      const previous=records[index-1],record=records[index];
      if(record.kind==='acceptance') {
        if(previous.kind!=='proposal' || record.revision!==previous.revision) throw new Error('Workspace history acceptance must match the pending proposal revision');
      } else if(record.kind==='change') {
        if(!['acceptance','change'].includes(previous.kind) || record.revision!==previous.revision+1) throw new Error('Workspace history change must follow accepted policy at the next revision');
      } else throw new Error('Workspace history cannot contain a later proposal');
    }
    return records;
  }

  function parseWorkspaceHistory(text) {
    if(typeof text!=='string') throw new Error('Workspace history must be text');
    if(!text) return [];
    if(!text.endsWith('\n')) throw new Error('Workspace history has an incomplete record');
    const records=text.trimEnd().split('\n').map((line,index)=>{
      try { return validRecord(JSON.parse(line)); }
      catch(error) { throw new Error(`Workspace history line ${index+1}: ${error.message}`); }
    });
    return validateHistory(records);
  }

  function assertAcceptedHistory(records,config) {
    const latest=records.at(-1);
    if(!latest || !['acceptance','change'].includes(latest.kind)) {
      throw new Error('Workspace configuration is pending human acceptance');
    }
    if(latest.digest!==workspaceConfigDigest(config)) {
      throw new Error('Workspace configuration changed after acceptance');
    }
    assertDefinitionProvenance(latest,config);
    return latest;
  }

  return {validRecord,validateHistory,parseWorkspaceHistory,assertAcceptedHistory};
}
