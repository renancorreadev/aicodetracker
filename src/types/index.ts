export enum ChangeType {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted',
}

export interface LineChange {
  line: number;
  type: ChangeType;
}
