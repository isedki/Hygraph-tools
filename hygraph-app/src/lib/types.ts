// Hygraph App SDK Types

export interface HygraphContext {
  // Project info
  project: {
    id: string;
    name: string;
  };
  // Environment info
  environment: {
    id: string;
    name: string;
  };
  // Current user
  user: {
    id: string;
    email: string;
  };
  // Auth token for API calls
  authToken: string;
  // API endpoint
  endpoint: string;
}

export interface SidebarContext extends HygraphContext {
  // Current entry being edited
  entry: {
    id: string;
    modelApiId: string;
    stage: string;
  } | null;
}

// Schema types (matching the main app)
export interface HygraphField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  relatedModel?: string;
  description?: string;
}

export interface HygraphModel {
  name: string;
  apiId: string;
  pluralApiId: string;
  fields: HygraphField[];
  isComponent?: boolean;
  isSystem?: boolean;
}

export interface HygraphEnum {
  name: string;
  values: string[];
}

export interface HygraphUnion {
  name: string;
  possibleTypes: string[];
}

export interface HygraphSchema {
  models: HygraphModel[];
  components: HygraphModel[];
  enums: HygraphEnum[];
  unions?: HygraphUnion[];
}

// Entry reference result
export interface EntryReference {
  entryId: string;
  entryTitle: string;
  modelName: string;
  modelPluralApiId: string;
  fieldName: string;
}

