export function prepareEstimateMutationRow(row = {}) {
  const { id: _databaseId, ...mutationRow } = row;
  return mutationRow;
}
