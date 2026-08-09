/* GENERATED — do not edit by hand. Rebuild: pnpm --filter @repo/erp-browser build */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BrowserIdGen: () => BrowserIdGen,
  SURFACE_VERSION: () => SURFACE_VERSION,
  createComms: () => createComms,
  createDocs: () => createDocs,
  createExtraction: () => createExtraction,
  createProjects: () => createProjects,
  createRates: () => createRates,
  createReconciliation: () => createReconciliation,
  createScheduling: () => createScheduling,
  defaultPorts: () => defaultPorts
});
module.exports = __toCommonJS(index_exports);

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../capabilities/extraction/src/model.ts
var FIELD_KEYS = [
  "issuerName",
  "issuerTaxId",
  "docNumber",
  "issueDate",
  "dueDate",
  "netAmount",
  "taxAmount",
  "withholdingAmount",
  "totalAmount",
  "iban",
  "orderRef"
];
var AMOUNT_FIELDS = [
  "netAmount",
  "taxAmount",
  "withholdingAmount",
  "totalAmount"
];
var extractionConfigSchema = external_exports.object({
  /** Below this, a field is sent for review. */
  reviewThreshold: external_exports.number().min(0).max(1).default(0.75),
  /** Cents of slack allowed when checking net + tax − withholding = total. */
  totalsToleranceCents: external_exports.number().int().min(0).default(2),
  /** Alternatives kept per field. */
  maxAlternatives: external_exports.number().int().min(0).max(10).default(3)
}).default({});

// ../capabilities/extraction/src/ports.ts
var EXTRACTION_PROFILE_PORT = "extraction-profile@1";

// ../capabilities/extraction/src/normalise.ts
function normaliseText(input) {
  const pages = Array.isArray(input) ? input : [input];
  const lines = [];
  const pageOf = [];
  pages.forEach((page, pageIndex) => {
    for (const raw of String(page ?? "").split(/\r\n|\r|\n/)) {
      const clean = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[\u00a0\u2007\u2009\u202f]/g, " ").replace(/\s+/g, " ").trim();
      if (!clean) continue;
      lines.push(clean);
      pageOf.push(pageIndex + 1);
    }
  });
  return { lines, pageOf };
}
function fold(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ../kernel/src/errors.ts
var FactoryError = class extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(`[${code}] ${message}`);
    this.name = "FactoryError";
    this.code = code;
    this.details = details;
  }
};

// ../kernel/src/money.ts
function assertInt(value, what) {
  if (!Number.isSafeInteger(value)) {
    throw new FactoryError("MONEY_NOT_INTEGER", `${what} must be a safe integer, got ${value}`);
  }
}
function roundDivHalfUp(n, d) {
  assertInt(n, "numerator");
  assertInt(d, "denominator");
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const q = Math.floor(abs / d);
  const r = abs - q * d;
  const result = sign * (r * 2 >= d ? q + 1 : q);
  return result === 0 ? 0 : result;
}
function sumCents(values) {
  let total = 0;
  for (const v of values) {
    assertInt(v, "cents value");
    total += v;
  }
  assertInt(total, "sum");
  return total;
}

// ../kernel/src/effective.ts
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function assertIsoDate(date, what = "date") {
  if (!ISO_DATE.test(date)) {
    throw new FactoryError("NO_EFFECTIVE_RULE", `${what} must be YYYY-MM-DD, got "${date}"`);
  }
}
function resolveAt(periods, date, what) {
  assertIsoDate(date, `${what} effective date`);
  for (const period of periods) {
    if (date >= period.validFrom && (period.validTo === void 0 || date <= period.validTo)) {
      return { value: period.value, period };
    }
  }
  throw new FactoryError(
    "NO_EFFECTIVE_RULE",
    `No effective rule for "${what}" at ${date}. Known windows start ${periods[0]?.validFrom ?? "(none)"}. Refusing to guess.`,
    { what, date }
  );
}

// ../kernel/src/clock.ts
var SystemClock = class {
  todayIso() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
};

// ../kernel/src/ports.ts
var PortRegistry = class {
  bindings = /* @__PURE__ */ new Map();
  bind(port, adapter, providerId) {
    const existing = this.bindings.get(port);
    if (existing) {
      throw new FactoryError(
        "PORT_CONFLICT",
        `Port ${port} is already bound by "${existing.providerId}"; "${providerId}" tried to bind it too. Two selected packs implement the same port \u2014 fix the tenant spec or the packs.`,
        { port, providers: [existing.providerId, providerId] }
      );
    }
    this.bindings.set(port, { adapter, providerId });
  }
  get(port) {
    const binding = this.bindings.get(port);
    if (!binding) {
      throw new FactoryError(
        "PORT_NOT_BOUND",
        `No adapter bound for port ${port}. A selected pack (jurisdiction or vertical) must provide it; the kernel and capabilities never ship defaults for it.`,
        { port }
      );
    }
    return binding.adapter;
  }
  tryGet(port) {
    return this.bindings.get(port)?.adapter ?? void 0;
  }
  has(port) {
    return this.bindings.has(port);
  }
  provider(port) {
    return this.bindings.get(port)?.providerId;
  }
  boundPorts() {
    return [...this.bindings.keys()].sort();
  }
};

// ../capabilities/extraction/src/service.ts
var FIELD_TOKEN = {
  issuerName: "text",
  issuerTaxId: "taxId",
  docNumber: "text",
  issueDate: "date",
  dueDate: "date",
  netAmount: "amount",
  taxAmount: "amount",
  withholdingAmount: "amount",
  totalAmount: "amount",
  iban: "account",
  orderRef: "text"
};
var ExtractionService = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  profile() {
    return this.deps.ports.get(EXTRACTION_PROFILE_PORT);
  }
  extract(input) {
    const profile = this.profile();
    const { lines, pageOf } = normaliseText(input.text);
    if (!lines.length) {
      throw new FactoryError(
        "INVALID_STATE",
        "No readable text: nothing to extract. Offer manual entry with the image attached."
      );
    }
    const folded = lines.map(fold);
    const perField = /* @__PURE__ */ new Map();
    for (const key of FIELD_KEYS) {
      perField.set(key, this.candidatesFor(key, lines, folded, pageOf, profile));
    }
    const issueDate = best(perField.get("issueDate"))?.value ?? input.assumeIssueDate;
    const taxBreakdown = this.taxBreakdown(lines, pageOf, profile);
    const fields = FIELD_KEYS.map((key) => this.toField(key, perField.get(key) ?? []));
    const checks = this.check(fields, taxBreakdown, issueDate, profile);
    for (const check of checks) {
      if (check.status !== "mismatch") continue;
      for (const f of fields) {
        if (!check.fields.includes(f.key)) continue;
        f.confidence = round(Math.max(0, f.confidence - 0.25));
        f.reasons = [...f.reasons, `contradicted by ${check.id}`];
      }
    }
    this.applyVerdicts(fields, checks);
    const threshold = this.deps.config.reviewThreshold;
    const needsReview = fields.filter((f) => f.verdict === "amber" || f.confidence < threshold).map((f) => f.key);
    return {
      lines,
      fields,
      taxBreakdown,
      checks,
      needsReview,
      profile: { id: profile.id, version: profile.version },
      confirmed: false
    };
  }
  /**
   * Re-run the consistency checks over values a person has edited.
   *
   * The validation screen needs this: the moment someone fixes the total, the
   * arithmetic verdict must move with it, and it must be the same arithmetic
   * the extractor used rather than a second copy living in the UI.
   */
  recheck(result, corrections) {
    const profile = this.profile();
    const fields = result.fields.map((f) => {
      if (!Object.prototype.hasOwnProperty.call(corrections, f.key)) return { ...f };
      const value = corrections[f.key] ?? null;
      const revalidated = this.validateValue(f.key, value, profile);
      return {
        ...f,
        value,
        raw: value === null ? null : String(value),
        confidence: 1,
        reasons: revalidated.reasons.length ? ["corrected by hand", ...revalidated.reasons] : ["corrected by hand"],
        validated: revalidated.validated,
        verdict: "amber"
        // finalised below
      };
    });
    const issueDate = fields.find((f) => f.key === "issueDate")?.value;
    const checks = this.check(fields, result.taxBreakdown, issueDate, profile);
    this.applyVerdicts(fields, checks);
    const threshold = this.deps.config.reviewThreshold;
    return {
      ...result,
      fields,
      checks,
      needsReview: fields.filter((f) => f.verdict === "amber" || f.confidence < threshold).map((f) => f.key),
      confirmed: false
    };
  }
  /**
   * Run whatever validator this field's kind has against a value that did not
   * come off the page. Amounts return false here and are decided by the
   * arithmetic in `applyVerdicts`, exactly as read values are.
   */
  validateValue(key, value, profile) {
    if (value === null || value === "") return { validated: false, reasons: [] };
    const kind = FIELD_TOKEN[key];
    if (kind === "taxId") {
      const c = profile.checkTaxId(String(value));
      if (c?.valid) return { validated: true, reasons: ["passes its check digit"] };
      return { validated: false, reasons: ["fails its check digit \u2014 read it again"] };
    }
    if (kind === "account") {
      const c = profile.checkAccountNumber?.(String(value));
      if (c?.valid) return { validated: true, reasons: ["passes its check digit"] };
      return { validated: false, reasons: ["fails its check digit \u2014 read it again"] };
    }
    if (kind === "date") {
      const iso = isRealDate(String(value)) ? String(value) : profile.parseDate(String(value));
      if (iso && isRealDate(iso)) return { validated: true, reasons: ["is a real calendar date"] };
      return { validated: false, reasons: ["is not a real calendar date"] };
    }
    return { validated: false, reasons: [] };
  }
  /* ------------------------------------------------------------------ */
  candidatesFor(key, lines, folded, pageOf, profile) {
    const kind = FIELD_TOKEN[key];
    const keywords = (profile.keywords[key] ?? []).map(fold);
    const out = [];
    lines.forEach((line, i) => {
      const spans = this.tokens(kind, line, i, pageOf[i], profile, key);
      for (const { span, value } of spans) {
        const reasons = [];
        let score2 = 0;
        let failedCheckDigit = false;
        let labelled = true;
        const hit = keywords.find((k) => folded[i].includes(k));
        if (hit && folded[i].indexOf(hit) < span.start) {
          score2 += 0.5;
          reasons.push(`labelled "${hit}"`);
        } else if (hit) {
          score2 += 0.35;
          reasons.push(`labelled "${hit}" on the same line`);
        } else if (i > 0 && keywords.some((k) => folded[i - 1].includes(k))) {
          score2 += 0.3;
          reasons.push("labelled on the line above");
        } else {
          labelled = false;
        }
        score2 += kind === "text" ? 0.15 : 0.3;
        reasons.push(`matched a ${kind} token`);
        let validated = false;
        if (kind === "taxId" || kind === "account") {
          const check = kind === "taxId" ? profile.checkTaxId(span.text) : profile.checkAccountNumber?.(span.text);
          if (check?.valid) {
            score2 += 0.2;
            validated = true;
            reasons.push("passes its check digit");
          } else if (check) {
            failedCheckDigit = true;
            reasons.push("fails its check digit \u2014 read it again");
          }
        }
        if (kind === "date" && typeof value === "string" && isRealDate(value)) {
          validated = true;
          reasons.push("is a real calendar date");
        }
        const position = i / Math.max(1, lines.length - 1);
        if (key === "totalAmount" && position > 0.6) {
          score2 += 0.1;
          reasons.push("near the foot of the document");
        }
        if ((key === "issuerTaxId" || key === "issuerName") && position < 0.4) {
          score2 += 0.1;
          reasons.push("near the head of the document");
        }
        if (!hit && score2 < 0.5) reasons.push("no label found nearby");
        if (failedCheckDigit) score2 = Math.min(score2, 0.5);
        out.push({
          value,
          raw: span.text,
          confidence: round(Math.min(1, score2)),
          source: span,
          reasons,
          labelled,
          validated
        });
      }
    });
    return out.sort((a, b) => b.confidence - a.confidence || a.source.line - b.source.line);
  }
  tokens(kind, line, lineIndex, page, profile, key) {
    const mk = (m2, value) => ({
      span: {
        line: lineIndex,
        text: m2[0],
        start: m2.index,
        end: m2.index + m2[0].length,
        page
      },
      value
    });
    if (kind === "text") {
      const keywords = (profile.keywords[key] ?? []).map(fold);
      const f = fold(line);
      for (const k of keywords) {
        const at = f.indexOf(k);
        if (at === -1) continue;
        const after = line.slice(at + k.length).replace(/^[\s:.#-]+/, "");
        if (!after) continue;
        const start = line.length - after.length;
        return [
          {
            span: { line: lineIndex, text: after, start, end: line.length, page },
            value: after
          }
        ];
      }
      return [];
    }
    const pattern = kind === "amount" ? profile.patterns.amount : kind === "date" ? profile.patterns.date : kind === "taxId" ? profile.patterns.taxId : profile.patterns.accountNumber;
    if (!pattern) return [];
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"
    );
    const found = [];
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m[0] === "") {
        re.lastIndex += 1;
        continue;
      }
      const value = kind === "amount" ? profile.parseAmountCents(m[0]) : kind === "date" ? profile.parseDate(m[0]) : kind === "taxId" ? profile.checkTaxId(m[0])?.value ?? null : profile.checkAccountNumber?.(m[0])?.value ?? m[0];
      if (value === null) continue;
      found.push(mk(m, value));
    }
    return found;
  }
  /** Rows of a document that states several rates (spec §5.2). */
  taxBreakdown(lines, pageOf, profile) {
    const rows = [];
    lines.forEach((line, i) => {
      const pct2 = new RegExp(profile.patterns.percent.source, "g");
      const hit = pct2.exec(line);
      if (!hit) return;
      const rateBp = profile.parsePercentBp(hit[0]);
      if (rateBp === null) return;
      const amounts = [];
      const amt = new RegExp(profile.patterns.amount.source, "g");
      let m;
      while ((m = amt.exec(line)) !== null) {
        if (m.index === hit.index) continue;
        const cents = profile.parseAmountCents(m[0]);
        if (cents !== null) amounts.push(cents);
      }
      if (!amounts.length) return;
      rows.push({
        rateBp,
        baseCents: amounts.length > 1 ? amounts[0] : null,
        taxCents: amounts.length > 1 ? amounts[1] : amounts[0],
        source: { line: i, text: line, start: 0, end: line.length, page: pageOf[i] }
      });
    });
    return rows;
  }
  check(fields, breakdown, issueDate, profile) {
    const val = (key) => {
      const f = fields.find((x) => x.key === key);
      return typeof f?.value === "number" ? f.value : null;
    };
    const net = val("netAmount");
    const tax = val("taxAmount");
    const withheld = val("withholdingAmount") ?? 0;
    const total = val("totalAmount");
    const checks = [];
    if (net === null || tax === null || total === null) {
      checks.push({
        id: "totals",
        status: "unknown",
        detail: "Not enough amounts were read to check the arithmetic.",
        fields: ["netAmount", "taxAmount", "totalAmount"]
      });
    } else {
      const expected = net + tax - withheld;
      const off = Math.abs(expected - total);
      checks.push({
        id: "totals",
        status: off <= this.deps.config.totalsToleranceCents ? "ok" : "mismatch",
        detail: off <= this.deps.config.totalsToleranceCents ? "Net + tax \u2212 withholding equals the total." : `Net + tax \u2212 withholding is ${expected}, but the total reads ${total}.`,
        fields: ["netAmount", "taxAmount", "withholdingAmount", "totalAmount"]
      });
    }
    if (net !== null && tax !== null && net > 0 && issueDate) {
      const rateBp = Math.round(tax / net * 1e4);
      const allowed = profile.expectedTaxRatesBp(issueDate);
      const near = allowed.find((r) => Math.abs(r - rateBp) <= 25);
      checks.push({
        id: "taxRate",
        status: near !== void 0 ? "ok" : "mismatch",
        detail: near !== void 0 ? `The tax is ${fmtBp(near)} of the net amount.` : `The tax works out at ${fmtBp(rateBp)} of the net amount, which is not a rate in force on ${issueDate}.`,
        fields: ["netAmount", "taxAmount"]
      });
    }
    if (breakdown.length > 1 && tax !== null) {
      const summed = breakdown.reduce((s, r) => s + (r.taxCents ?? 0), 0);
      const off = Math.abs(summed - tax);
      checks.push({
        id: "breakdown",
        status: off <= this.deps.config.totalsToleranceCents ? "ok" : "mismatch",
        detail: off <= this.deps.config.totalsToleranceCents ? `The ${breakdown.length} rate rows add up to the tax total.` : `The ${breakdown.length} rate rows add up to ${summed}, but the tax total reads ${tax}.`,
        fields: ["taxAmount"]
      });
    }
    return checks;
  }
  toField(key, candidates) {
    const answerable = isAmountField(key) ? candidates.filter((c) => c.labelled) : candidates;
    const top = answerable[0];
    if (!top) {
      const unlabelled = candidates.slice(0, this.deps.config.maxAlternatives);
      if (unlabelled.length) {
        return {
          key,
          value: null,
          raw: null,
          confidence: 0,
          source: null,
          alternatives: unlabelled,
          reasons: ["found amounts, but none of them was labelled as this field"],
          validated: false,
          verdict: "amber"
        };
      }
    }
    if (!top) {
      return {
        key,
        value: null,
        raw: null,
        confidence: 0,
        source: null,
        alternatives: [],
        reasons: ["not found"],
        validated: false,
        verdict: "amber"
      };
    }
    const agreeing = answerable.filter((c) => c.value === top.value).length;
    const confidence = round(Math.min(1, top.confidence + (agreeing > 1 ? 0.05 : 0)));
    const alternatives = candidates.filter((c) => c !== top).filter((c) => c.value !== top.value).slice(0, this.deps.config.maxAlternatives);
    return {
      key,
      value: top.value,
      raw: top.raw,
      confidence,
      source: top.source,
      alternatives,
      reasons: agreeing > 1 ? [...top.reasons, `read ${agreeing} times`] : top.reasons,
      validated: top.validated,
      verdict: "amber"
      // finalised by applyVerdicts, once the checks are known
    };
  }
  /**
   * Colour the dots, after the consistency checks — which is the only moment
   * the answer is knowable, because an amount is validated by its arithmetic
   * rather than by anything about the amount itself.
   *
   * Mutates in place, deliberately: it runs on freshly built field objects
   * inside `extract` and `recheck`, and copying them again to set two
   * properties would only make the ordering harder to follow.
   */
  applyVerdicts(fields, checks) {
    const totals = checks.find((c) => c.id === "totals");
    const contradicted = /* @__PURE__ */ new Set();
    for (const c of checks)
      if (c.status === "mismatch") for (const k of c.fields) contradicted.add(k);
    for (const f of fields) {
      if (f.value === null || contradicted.has(f.key)) {
        f.verdict = "amber";
        continue;
      }
      if (isAmountField(f.key)) {
        const ok = totals?.status === "ok";
        f.validated = ok;
        f.verdict = ok ? "green" : "amber";
        continue;
      }
      f.verdict = f.validated ? "green" : "amber";
    }
  }
};
function isRealDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
function isAmountField(key) {
  return AMOUNT_FIELDS.includes(key);
}
function best(candidates) {
  return candidates?.[0];
}
function round(n) {
  return Math.round(n * 100) / 100;
}
function fmtBp(bp3) {
  return `${(bp3 / 100).toFixed(2).replace(/\.00$/, "")} per cent`;
}

// ../packs/jurisdiction-es-es/src/tax/rates.ts
var IVA_GENERAL_BP = [{ validFrom: "2012-09-01", value: 2100 }];
var IVA_REDUCIDO_BP = [
  { validFrom: "2012-09-01", value: 1e3 }
];
var IVA_SUPERREDUCIDO_BP = [
  { validFrom: "2012-09-01", value: 400 }
];

// ../packs/jurisdiction-es-es/src/tax/adapter.ts
var PACK_ID = "jurisdiction/es-ES";
var PACK_VERSION = "1.0.0";

// ../packs/jurisdiction-es-es/src/extraction/taxid.ts
var NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
var CIF_DIGIT_ONLY = /* @__PURE__ */ new Set(["A", "B", "E", "H"]);
var CIF_LETTER_ONLY = /* @__PURE__ */ new Set(["K", "P", "Q", "S"]);
var CIF_LETTERS = "JABCDEFGHI";
function normaliseTaxId(raw) {
  return raw.toUpperCase().replace(/[\s.\-/]/g, "").trim();
}
function checkSpanishTaxId(raw) {
  const value = normaliseTaxId(raw);
  if (/^\d{8}[A-Z]$/.test(value)) {
    const digits = Number(value.slice(0, 8));
    return { value, valid: NIF_LETTERS[digits % 23] === value[8], kind: "nif" };
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(value)) {
    const lead = "XYZ".indexOf(value[0]);
    const digits = Number(`${lead}${value.slice(1, 8)}`);
    return { value, valid: NIF_LETTERS[digits % 23] === value[8], kind: "nie" };
  }
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(value)) {
    const body = value.slice(1, 8);
    let sum = 0;
    for (let i = 0; i < body.length; i++) {
      const digit = Number(body[i]);
      if (i % 2 === 0) {
        const doubled = digit * 2;
        sum += Math.floor(doubled / 10) + doubled % 10;
      } else {
        sum += digit;
      }
    }
    const control = (10 - sum % 10) % 10;
    const given = value[8];
    const lead = value[0];
    const validDigit = given === String(control);
    const validLetter = given === CIF_LETTERS[control];
    const valid = CIF_DIGIT_ONLY.has(lead) ? validDigit : CIF_LETTER_ONLY.has(lead) ? validLetter : validDigit || validLetter;
    return { value, valid, kind: "cif" };
  }
  return null;
}
function checkIban(raw) {
  const value = raw.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value)) return null;
  const rearranged = value.slice(4) + value.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  return { value, valid: remainder === 1 };
}

// ../packs/jurisdiction-es-es/src/extraction/profile.ts
var MONTHS = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
  // Catalan, because invoices in this market arrive in both languages.
  gener: "01",
  febrer: "02",
  mar\u00E7: "03",
  marc: "03",
  abril_ca: "04",
  maig: "05",
  juny: "06",
  juliol: "07",
  agost: "08",
  octubre_ca: "10",
  novembre: "11",
  desembre: "12"
};
var MONTH_ALTERNATION = Object.keys(MONTHS).filter((m) => !m.includes("_")).join("|");
function parseAmountCents(raw) {
  const cleaned = raw.replace(/[€\s]/g, "").replace(/^[+]/, "");
  const m = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/.exec(cleaned);
  if (!m) return null;
  const units = Number(m[2].replace(/\./g, ""));
  const cents = Number(m[3]);
  const value = units * 100 + cents;
  return m[1] === "-" ? -value : value;
}
function parseDate(raw) {
  const text = raw.trim().toLowerCase();
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (numeric) {
    const day = numeric[1].padStart(2, "0");
    const month = numeric[2].padStart(2, "0");
    let year = numeric[3];
    if (year.length === 2) year = `20${year}`;
    return isRealDate2(year, month, day) ? `${year}-${month}-${day}` : null;
  }
  const long = new RegExp(
    `^(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_ALTERNATION})\\s+(?:de[l]?\\s+)?(\\d{4})$`
  ).exec(text);
  if (long) {
    const month = MONTHS[long[2]];
    if (!month) return null;
    const day = long[1].padStart(2, "0");
    return isRealDate2(long[3], month, day) ? `${long[3]}-${month}-${day}` : null;
  }
  return null;
}
function isRealDate2(year, month, day) {
  const d = /* @__PURE__ */ new Date(`${year}-${month}-${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCFullYear() === Number(year) && d.getUTCMonth() + 1 === Number(month) && d.getUTCDate() === Number(day);
}
function parsePercentBp(raw) {
  const m = /^(\d{1,2})(?:[.,](\d{1,2}))?\s?%$/.exec(raw.trim());
  if (!m) return null;
  const whole = Number(m[1]) * 100;
  const frac = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return whole + frac;
}
function checkTaxId(raw) {
  const result = checkSpanishTaxId(raw);
  return result ? { value: result.value, valid: result.valid } : null;
}
var ES_EXTRACTION_PROFILE = {
  id: `${PACK_ID}/extraction`,
  version: PACK_VERSION,
  keywords: {
    issuerName: ["razon social", "emisor", "proveedor", "expedido por", "datos del emisor"],
    issuerTaxId: ["nif", "cif", "n.i.f", "c.i.f", "nie", "identificacion fiscal"],
    docNumber: [
      "factura n",
      "n factura",
      "numero de factura",
      "num factura",
      "factura numero",
      "n de documento",
      "albaran n"
    ],
    issueDate: ["fecha de factura", "fecha factura", "fecha de emision", "fecha emision", "fecha"],
    dueDate: ["vencimiento", "fecha de vencimiento", "vence el", "forma de pago vencimiento"],
    netAmount: ["base imponible", "base", "subtotal", "importe neto"],
    taxAmount: ["cuota iva", "iva", "i.v.a", "cuota"],
    withholdingAmount: ["retencion", "irpf", "ret. irpf", "retencion irpf"],
    totalAmount: ["total factura", "total a pagar", "importe total", "total"],
    iban: ["iban", "cuenta", "cta", "domiciliacion"],
    orderRef: ["pedido", "n pedido", "su pedido", "obra", "referencia obra", "presupuesto n"]
  },
  patterns: {
    // Money: optional euro sign, thousands points, decimal comma.
    amount: /-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\s?€?|-?\s?\d+,\d{2}\s?€?/g,
    date: new RegExp(
      `\\b\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}\\b|\\b\\d{1,2}\\s+de\\s+(?:${MONTH_ALTERNATION})\\s+de[l]?\\s+\\d{4}\\b`,
      "gi"
    ),
    taxId: /\b[A-Z]?\d{7,8}[-\s]?[A-Z0-9]\b/g,
    percent: /\b\d{1,2}(?:[.,]\d{1,2})?\s?%/g,
    accountNumber: /\bES\d{2}[\s]?(?:\d{4}[\s]?){5}\b/g,
    docNumber: /\b[A-Z]{0,4}[-/]?\d{2,}[-/]?\d*\b/g
  },
  parseAmountCents,
  parseDate,
  parsePercentBp,
  checkTaxId,
  checkAccountNumber(raw) {
    return checkIban(raw);
  },
  /**
   * The rates that were law on that date, resolved from the pack's own
   * effective-dated tables — never a constant. A document from before a rate
   * change must be checked against the rate of its own day.
   */
  expectedTaxRatesBp(issueDateIso) {
    const at = (table, what) => {
      try {
        return resolveAt(table, issueDateIso, what).value;
      } catch {
        return null;
      }
    };
    return [
      at(IVA_GENERAL_BP, "general rate"),
      at(IVA_REDUCIDO_BP, "reduced rate"),
      at(IVA_SUPERREDUCIDO_BP, "super-reduced rate"),
      // Exempt and reverse-charge documents state no tax at all.
      0
    ].filter((r) => r !== null);
  }
};

// ../capabilities/docs/src/annex.ts
var ANNEX_DEFAULT_ENABLED = true;
var ANNEX_DEFAULT_IMAGES_PER_PAGE = 2;
var ANNEX_MAX_IMAGES_PER_PAGE = 12;
function resolveAnnexOptions(o) {
  const raw = Number(o?.imagesPerPage);
  const perPage = Number.isFinite(raw) ? Math.min(ANNEX_MAX_IMAGES_PER_PAGE, Math.max(1, Math.round(raw))) : ANNEX_DEFAULT_IMAGES_PER_PAGE;
  return {
    enabled: typeof o?.enabled === "boolean" ? o.enabled : ANNEX_DEFAULT_ENABLED,
    imagesPerPage: perPage
  };
}
function compareNumbering(a, b) {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const sa = pa[i];
    const sb = pb[i];
    if (sa === void 0) return -1;
    if (sb === void 0) return 1;
    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) return na - nb;
    } else if (sa !== sb) {
      return sa < sb ? -1 : 1;
    }
  }
  return 0;
}
function composeAnnex(images, options) {
  const opts = resolveAnnexOptions(options);
  if (!opts.enabled || images.length === 0) {
    return { enabled: opts.enabled, pages: [], plateCount: 0, markedItems: [] };
  }
  const ordered = images.map((img, i) => ({ img, i })).sort((a, b) => {
    const g = compareNumbering(a.img.groupNum, b.img.groupNum);
    if (g !== 0) return g;
    const it = compareNumbering(a.img.itemNum, b.img.itemNum);
    if (it !== 0) return it;
    const o = (a.img.order ?? 0) - (b.img.order ?? 0);
    if (o !== 0) return o;
    return a.i - b.i;
  }).map((x) => x.img);
  const perItem = /* @__PURE__ */ new Map();
  for (const img of ordered) perItem.set(img.itemNum, (perItem.get(img.itemNum) ?? 0) + 1);
  const seen = /* @__PURE__ */ new Map();
  const plates = ordered.map((img) => {
    const siblings = perItem.get(img.itemNum) ?? 1;
    const n = (seen.get(img.itemNum) ?? 0) + 1;
    seen.set(img.itemNum, n);
    return {
      ref: img.ref,
      groupNum: img.groupNum,
      groupName: img.groupName,
      itemNum: img.itemNum,
      itemLabel: img.itemLabel,
      caption: img.caption ?? "",
      sequence: siblings > 1 ? n : null,
      siblings
    };
  });
  const pages = [];
  for (let i = 0; i < plates.length; i += opts.imagesPerPage) {
    pages.push({
      number: pages.length + 1,
      plates: plates.slice(i, i + opts.imagesPerPage)
    });
  }
  return {
    enabled: true,
    pages,
    plateCount: plates.length,
    markedItems: [...perItem.keys()].sort(compareNumbering)
  };
}

// ../capabilities/scheduling/src/calendar.ts
function everyDayCalendar() {
  return { workingWeekdays: [0, 1, 2, 3, 4, 5, 6], nonWorkingDates: [] };
}
var ISO = /^\d{4}-\d{2}-\d{2}$/;
var MAX_SEARCH_DAYS = 3660;
function assertIso(date) {
  if (!ISO.test(date)) {
    throw new FactoryError("INVALID_STATE", `Date must be ISO yyyy-mm-dd, received "${date}".`);
  }
}
function toUtc(date) {
  assertIso(date);
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new FactoryError("INVALID_STATE", `Not a real date: "${date}".`);
  return new Date(ms);
}
function toIso(d) {
  return d.toISOString().slice(0, 10);
}
function shift(date, days) {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}
function isWorkingDay(cal, date) {
  const weekday = toUtc(date).getUTCDay();
  if (!cal.workingWeekdays.includes(weekday)) return false;
  return !cal.nonWorkingDates.includes(date);
}
function snapForward(cal, date) {
  let cursor = date;
  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    if (isWorkingDay(cal, cursor)) return cursor;
    cursor = shift(cursor, 1);
  }
  throw noWorkingDay(date, "after");
}
function snapBack(cal, date) {
  let cursor = date;
  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    if (isWorkingDay(cal, cursor)) return cursor;
    cursor = shift(cursor, -1);
  }
  throw noWorkingDay(date, "before");
}
function addWorkingDays(cal, date, steps) {
  let cursor = steps >= 0 ? snapForward(cal, date) : snapBack(cal, date);
  const dir = steps >= 0 ? 1 : -1;
  let remaining = Math.abs(steps);
  let guard = 0;
  while (remaining > 0) {
    cursor = shift(cursor, dir);
    if (isWorkingDay(cal, cursor)) remaining -= 1;
    guard += 1;
    if (guard > MAX_SEARCH_DAYS) throw noWorkingDay(date, dir > 0 ? "after" : "before");
  }
  return cursor;
}
function workingDaysInclusive(cal, start, finish) {
  if (finish < start) return 0;
  let count = 0;
  let cursor = start;
  for (let i = 0; i <= MAX_SEARCH_DAYS && cursor <= finish; i++) {
    if (isWorkingDay(cal, cursor)) count += 1;
    cursor = shift(cursor, 1);
  }
  return count;
}
function workingDayOffset(cal, from, to) {
  if (from === to) return 0;
  const forward = to > from;
  const [a, b] = forward ? [from, to] : [to, from];
  const span = workingDaysInclusive(cal, a, b);
  const steps = Math.max(0, span - 1);
  return forward ? steps : -steps;
}
function finishOf(cal, start, durationDays) {
  if (durationDays <= 0) return snapForward(cal, start);
  return addWorkingDays(cal, start, durationDays - 1);
}
function startFor(cal, finish, durationDays) {
  if (durationDays <= 0) return snapBack(cal, finish);
  return addWorkingDays(cal, finish, -(durationDays - 1));
}
function noWorkingDay(date, direction) {
  return new FactoryError(
    "INVALID_STATE",
    `The calendar has no working day within ${MAX_SEARCH_DAYS} days ${direction} ${date}. Check workingWeekdays and nonWorkingDates.`
  );
}

// ../capabilities/scheduling/src/cpm.ts
function calendarOf(plan) {
  return plan.calendar ?? everyDayCalendar();
}
function durationOf(cal, task) {
  if (task.milestone) return 0;
  if (typeof task.durationDays === "number") return Math.max(0, Math.round(task.durationDays));
  return Math.max(1, workingDaysInclusive(cal, task.plannedStart, task.plannedEnd));
}
function topologicalOrder(tasks, deps) {
  const indegree = /* @__PURE__ */ new Map();
  const successors = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    indegree.set(t.id, 0);
    successors.set(t.id, []);
  }
  for (const d of deps) {
    if (!indegree.has(d.predecessorId) || !indegree.has(d.successorId)) {
      throw new FactoryError(
        "NOT_FOUND",
        `Dependency ${d.id} points at a task that is not in the plan.`,
        { predecessorId: d.predecessorId, successorId: d.successorId }
      );
    }
    successors.get(d.predecessorId).push(d.successorId);
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }
  const ready = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      const left = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, left);
      if (left === 0) ready.push(s);
    }
  }
  if (order.length !== tasks.length) {
    const stuck = tasks.filter((t) => !order.includes(t.id)).map((t) => t.id);
    throw new FactoryError(
      "INVALID_STATE",
      `The dependencies form a cycle: ${stuck.join(" \u2192 ")}.`,
      {
        taskIds: stuck
      }
    );
  }
  return order;
}
function computeSchedule(plan, opts = {}) {
  const cal = calendarOf(plan);
  const tasks = plan.tasks;
  const deps = plan.dependencies ?? [];
  if (!tasks.length) {
    const anchor = snapForward(cal, opts.from ?? "1970-01-01");
    return { start: anchor, finish: anchor, tasks: [], criticalPath: [] };
  }
  const order = topologicalOrder(tasks, deps);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predsOf = /* @__PURE__ */ new Map();
  const succsOf = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    predsOf.set(t.id, []);
    succsOf.set(t.id, []);
  }
  for (const d of deps) {
    predsOf.get(d.successorId).push(d);
    succsOf.get(d.predecessorId).push(d);
  }
  const anchors = tasks.map((t) => t.earliestStart ?? t.plannedStart);
  const planStart = snapForward(cal, opts.from ?? anchors.reduce((a, b) => a < b ? a : b));
  const start = /* @__PURE__ */ new Map();
  const finish = /* @__PURE__ */ new Map();
  for (const id of order) {
    const task = byId.get(id);
    const duration = durationOf(cal, task);
    let earliest = snapForward(cal, task.earliestStart ?? planStart);
    for (const d of predsOf.get(id) ?? []) {
      const ps = start.get(d.predecessorId);
      const pf = finish.get(d.predecessorId);
      let candidate;
      if (d.type === "FS") candidate = addWorkingDays(cal, pf, 1 + d.lagDays);
      else if (d.type === "SS") candidate = addWorkingDays(cal, ps, d.lagDays);
      else candidate = startFor(cal, addWorkingDays(cal, pf, d.lagDays), duration);
      if (candidate > earliest) earliest = candidate;
    }
    start.set(id, earliest);
    finish.set(id, finishOf(cal, earliest, duration));
  }
  const planFinish = order.map((id) => finish.get(id)).reduce((a, b) => a > b ? a : b);
  const lateStart = /* @__PURE__ */ new Map();
  const lateFinish = /* @__PURE__ */ new Map();
  for (const id of [...order].reverse()) {
    const task = byId.get(id);
    const duration = durationOf(cal, task);
    let latestFinish = planFinish;
    for (const d of succsOf.get(id) ?? []) {
      const ss = lateStart.get(d.successorId);
      const sf = lateFinish.get(d.successorId);
      let candidate;
      if (d.type === "FS") candidate = addWorkingDays(cal, ss, -(1 + d.lagDays));
      else if (d.type === "SS")
        candidate = finishOf(cal, addWorkingDays(cal, ss, -d.lagDays), duration);
      else candidate = addWorkingDays(cal, sf, -d.lagDays);
      if (candidate < latestFinish) latestFinish = candidate;
    }
    lateFinish.set(id, latestFinish);
    lateStart.set(id, startFor(cal, latestFinish, duration));
  }
  const scheduled = order.map((id) => {
    const task = byId.get(id);
    const float = workingDayOffset(cal, start.get(id), lateStart.get(id));
    return {
      taskId: id,
      start: start.get(id),
      finish: finish.get(id),
      durationDays: durationOf(cal, task),
      lateStart: lateStart.get(id),
      lateFinish: lateFinish.get(id),
      totalFloatDays: float,
      critical: float <= 0
    };
  });
  return {
    start: scheduled.map((s) => s.start).reduce((a, b) => a < b ? a : b, planStart),
    finish: planFinish,
    tasks: scheduled,
    criticalPath: scheduled.filter((s) => s.critical).map((s) => s.taskId)
  };
}
function applySchedule(plan, schedule) {
  const byId = new Map(schedule.tasks.map((s) => [s.taskId, s]));
  return {
    ...plan,
    tasks: plan.tasks.map((t) => {
      const s = byId.get(t.id);
      return s ? { ...t, plannedStart: s.start, plannedEnd: s.finish } : t;
    })
  };
}

// ../capabilities/scheduling/src/baseline.ts
function freezeBaseline(plan, input) {
  const existing = plan.baselines ?? [];
  if (existing.some((b) => b.label === input.label)) {
    throw new FactoryError(
      "IMMUTABLE",
      `A baseline labelled "${input.label}" already exists and cannot be replaced.`
    );
  }
  const cal = calendarOf(plan);
  const tasks = plan.tasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    start: t.plannedStart,
    finish: t.plannedEnd,
    durationDays: durationOf(cal, t),
    milestone: t.milestone
  }));
  const finish = tasks.length ? tasks.map((t) => t.finish).reduce((a, b) => a > b ? a : b) : input.frozenAt;
  const baseline = {
    id: input.id,
    label: input.label,
    frozenAt: input.frozenAt,
    finish,
    tasks
  };
  return { ...plan, baselines: [...existing, baseline] };
}
function compareToBaseline(plan, baselineId) {
  const baselines = plan.baselines ?? [];
  if (!baselines.length) {
    throw new FactoryError("NOT_FOUND", "The plan has no baseline to compare against.");
  }
  const baseline = baselineId ? baselines.find((b) => b.id === baselineId) : baselines[baselines.length - 1];
  if (!baseline) {
    throw new FactoryError("NOT_FOUND", `Baseline ${baselineId} not found.`);
  }
  const cal = calendarOf(plan);
  const current = new Map(plan.tasks.map((t) => [t.id, t]));
  const drifts = [];
  for (const b of baseline.tasks) {
    const now = current.get(b.taskId);
    if (!now) {
      drifts.push({
        taskId: b.taskId,
        title: b.title,
        status: "removed",
        startDriftDays: 0,
        finishDriftDays: 0,
        durationDriftDays: -b.durationDays
      });
      continue;
    }
    const startDrift = workingDayOffset(cal, b.start, now.plannedStart);
    const finishDrift = workingDayOffset(cal, b.finish, now.plannedEnd);
    drifts.push({
      taskId: b.taskId,
      title: now.title,
      status: finishDrift > 0 ? "late" : finishDrift < 0 ? "ahead" : "on_plan",
      startDriftDays: startDrift,
      finishDriftDays: finishDrift,
      durationDriftDays: durationOf(cal, now) - b.durationDays
    });
  }
  const known = new Set(baseline.tasks.map((t) => t.taskId));
  for (const t of plan.tasks) {
    if (known.has(t.id)) continue;
    drifts.push({
      taskId: t.id,
      title: t.title,
      status: "added",
      startDriftDays: 0,
      finishDriftDays: 0,
      durationDriftDays: durationOf(cal, t)
    });
  }
  const currentFinish = plan.tasks.length ? plan.tasks.map((t) => t.plannedEnd).reduce((a, b) => a > b ? a : b) : baseline.finish;
  return {
    baselineId: baseline.id,
    label: baseline.label,
    baselineFinish: baseline.finish,
    currentFinish,
    finishDriftDays: workingDayOffset(cal, baseline.finish, currentFinish),
    tasks: drifts
  };
}

// ../capabilities/scheduling/src/derive.ts
var DEFAULT_DURATION_DAYS = 5;
function compareNumbering2(a, b) {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const sa = pa[i];
    const sb = pb[i];
    if (sa === void 0) return -1;
    if (sb === void 0) return 1;
    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) return na - nb;
    } else if (sa !== sb) {
      return sa < sb ? -1 : 1;
    }
  }
  return 0;
}
function durationFor(item, defaultDays) {
  if (typeof item.durationDays === "number" && Number.isFinite(item.durationDays)) {
    return { days: Math.max(1, Math.round(item.durationDays)), basis: "explicit" };
  }
  const qty = Number(item.quantity);
  const rate = Number(item.ratePerDay);
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
    return { days: Math.max(1, Math.ceil(qty / rate)), basis: "quantity" };
  }
  return { days: Math.max(1, Math.round(defaultDays)), basis: "default" };
}
function planFromWorkBreakdown(items, options) {
  const cal = options.calendar ?? everyDayCalendar();
  const granularity = options.granularity ?? "group";
  const defaultDays = options.defaultDurationDays ?? DEFAULT_DURATION_DAYS;
  const groupLag = options.groupLagDays ?? 0;
  const start = snapForward(cal, options.from);
  const skipped = [];
  const usable = items.filter((it) => {
    if (it.skip || !it.title) {
      skipped.push(it.ref);
      return false;
    }
    return true;
  });
  const ordered = usable.map((item, i) => ({ item, i })).sort((a, b) => {
    const g = compareNumbering2(a.item.groupNum, b.item.groupNum);
    if (g !== 0) return g;
    const it = compareNumbering2(a.item.itemNum ?? "", b.item.itemNum ?? "");
    if (it !== 0) return it;
    return a.i - b.i;
  }).map((x) => x.item);
  const tasks = [];
  const dependencies = [];
  const notes = [];
  const push = (id, title, days, note, assignee, sourceRef, lag) => {
    const previous = tasks[tasks.length - 1];
    tasks.push({
      id,
      title,
      assignee,
      // A first pass, deliberately: every task starts where the work could
      // start, and the CPM engine then pushes it out behind its predecessors.
      plannedStart: start,
      plannedEnd: finishOf(cal, start, days),
      status: "planned",
      progressPct: 0,
      milestone: false,
      durationDays: days,
      sourceRef
    });
    if (previous) {
      dependencies.push({
        id: `dep_${previous.id}__${id}`,
        predecessorId: previous.id,
        successorId: id,
        type: "FS",
        lagDays: lag
      });
    }
    notes.push(note);
  };
  if (granularity === "item") {
    let lastGroup = null;
    for (const item of ordered) {
      const { days, basis } = durationFor(item, defaultDays);
      const lag = lastGroup !== null && lastGroup !== item.groupNum ? groupLag : 0;
      lastGroup = item.groupNum;
      push(
        `task_${item.ref}`,
        `${item.itemNum ? item.itemNum + " " : ""}${item.title}`,
        days,
        {
          taskId: `task_${item.ref}`,
          title: item.title,
          durationDays: days,
          basis,
          quantity: item.quantity,
          unit: item.unit,
          ratePerDay: item.ratePerDay
        },
        item.assignee,
        item.ref,
        lag
      );
    }
  } else {
    const groups = /* @__PURE__ */ new Map();
    for (const item of ordered) {
      const { days } = durationFor(item, defaultDays);
      const g = groups.get(item.groupNum);
      if (g) {
        g.days += days;
        g.refs.push(item.ref);
      } else {
        groups.set(item.groupNum, { name: item.groupName, days, refs: [item.ref] });
      }
    }
    let first = true;
    for (const [num, g] of groups) {
      const id = `task_group_${num}`;
      push(
        id,
        `${num}. ${g.name}`,
        g.days,
        { taskId: id, title: g.name, durationDays: g.days, basis: "quantity" },
        void 0,
        `group:${num}`,
        first ? 0 : groupLag
      );
      first = false;
    }
  }
  return {
    plan: { tasks, dependencies, calendar: cal, baselines: [] },
    notes,
    skipped
  };
}
function mergeDerivedPlan(previous, derived) {
  const before = new Map(previous.tasks.map((t) => [t.id, t]));
  return {
    ...derived,
    tasks: derived.tasks.map((t) => {
      const old = before.get(t.id);
      if (!old) return t;
      return {
        ...t,
        progressPct: old.progressPct,
        status: old.status,
        assignee: old.assignee ?? t.assignee,
        earliestStart: old.earliestStart
      };
    }),
    // Baselines are promises already made; a re-derivation does not get to
    // rewrite them.
    baselines: previous.baselines ?? [],
    progressLog: previous.progressLog
  };
}

// ../capabilities/scheduling/src/tracking.ts
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
var pct = (part, whole) => whole === 0 ? 0 : Math.round(part / whole * 1e3) / 10;
function weightOf(weights, st) {
  const w = weights?.[st.taskId];
  if (typeof w === "number" && Number.isFinite(w) && w > 0) return w;
  return Math.max(st.durationDays, 1);
}
function plannedFractionAt(cal, st, date) {
  if (date < st.start) return 0;
  if (date >= st.finish) return 1;
  const done = workingDaysInclusive(cal, st.start, date);
  const total = Math.max(1, st.durationDays);
  return clamp(done / total, 0, 1);
}
function recordedPctAt(log, taskId, date) {
  let best2 = null;
  for (const e of log) {
    if (e.taskId !== taskId || e.date > date) continue;
    if (!best2 || e.date > best2.date) best2 = e;
  }
  return best2 ? best2.pct : null;
}
function progressCurve(plan, schedule, options) {
  const cal = calendarOf(plan);
  const log = plan.progressLog ?? [];
  const asOf = options.asOf;
  const scheduled = schedule.tasks;
  const totalWeight = scheduled.reduce((s, st) => s + weightOf(options.weights, st), 0);
  const plannedAt = (date) => pct(
    scheduled.reduce(
      (s, st) => s + weightOf(options.weights, st) * plannedFractionAt(cal, st, date),
      0
    ),
    totalWeight
  );
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const actualAt = (date) => {
    let any = false;
    let sum = 0;
    for (const st of scheduled) {
      const recorded = recordedPctAt(log, st.taskId, date);
      if (recorded !== null) any = true;
      sum += weightOf(options.weights, st) * (clamp(recorded ?? 0, 0, 100) / 100);
    }
    return any ? pct(sum, totalWeight) : null;
  };
  const actualNow = pct(
    scheduled.reduce((s, st) => {
      const t = byId.get(st.taskId);
      return s + weightOf(options.weights, st) * (clamp(t?.progressPct ?? 0, 0, 100) / 100);
    }, 0),
    totalWeight
  );
  const plannedNow = plannedAt(asOf);
  const performanceIndex = plannedNow > 0 ? Math.round(actualNow / plannedNow * 100) / 100 : null;
  const remainingDays = asOf >= schedule.finish ? 0 : Math.max(0, workingDaysInclusive(cal, asOf, schedule.finish) - 1);
  const stretch = performanceIndex && performanceIndex > 0 ? 1 / performanceIndex : 1;
  const projectedFinish = remainingDays === 0 ? schedule.finish : addWorkingDays(cal, snapForward(cal, asOf), Math.round(remainingDays * stretch));
  const horizon = projectedFinish > schedule.finish ? projectedFinish : schedule.finish;
  const span = Math.max(1, workingDaysInclusive(cal, schedule.start, horizon));
  const samples = Math.max(2, Math.min(options.samples ?? 24, span));
  const step = Math.max(1, Math.ceil(span / samples));
  const points = [];
  for (let d = 0; d < span; d += step) {
    const date = addWorkingDays(cal, schedule.start, d);
    points.push({
      date,
      plannedPct: plannedAt(date),
      actualPct: date <= asOf ? actualAt(date) : null,
      // Anchored on the actual line so the two meet rather than jumping at
      // `asOf`, then continuing at the observed pace: the work the plan
      // expects between now and `date`, achieved at `performanceIndex` of it.
      projectedPct: date > asOf ? clamp(actualNow + (plannedAt(date) - plannedNow) * (performanceIndex ?? 1), 0, 100) : null
    });
  }
  const last = points[points.length - 1];
  if (!last || last.date !== horizon) {
    points.push({
      date: horizon,
      plannedPct: plannedAt(horizon),
      actualPct: horizon <= asOf ? actualAt(horizon) : null,
      projectedPct: horizon > asOf ? 100 : null
    });
  }
  return {
    asOf,
    points,
    plannedPct: plannedNow,
    actualPct: actualNow,
    driftPct: Math.round((actualNow - plannedNow) * 10) / 10,
    performanceIndex,
    plannedFinish: schedule.finish,
    projectedFinish
  };
}
function riskReport(plan, schedule, options) {
  const cal = calendarOf(plan);
  const asOf = options.asOf;
  const tolerance = options.tolerancePct ?? 10;
  const threshold = options.thresholdDays ?? 5;
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const baselines = plan.baselines ?? [];
  const baseline = options.baselineLabel ? baselines.find((b) => b.label === options.baselineLabel) : baselines[baselines.length - 1];
  const baselineFinish = baseline ? baseline.finish : null;
  const delayDays = baselineFinish ? workingDayOffset(cal, baselineFinish, schedule.finish) : 0;
  const items = [];
  for (const st of schedule.tasks) {
    const task = byId.get(st.taskId);
    if (!task) continue;
    const actual = clamp(task.progressPct ?? 0, 0, 100);
    const planned = Math.round(plannedFractionAt(cal, st, asOf) * 100);
    if (actual >= 100) continue;
    if (st.finish < asOf) {
      items.push({
        taskId: st.taskId,
        title: task.title,
        kind: "overdue",
        critical: st.critical,
        days: workingDayOffset(cal, st.finish, asOf),
        plannedPct: planned,
        actualPct: actual
      });
    } else if (actual === 0 && st.start < asOf) {
      items.push({
        taskId: st.taskId,
        title: task.title,
        kind: "not_started",
        critical: st.critical,
        days: workingDayOffset(cal, st.start, asOf),
        plannedPct: planned,
        actualPct: actual
      });
    } else if (planned - actual > tolerance) {
      items.push({
        taskId: st.taskId,
        title: task.title,
        kind: "behind",
        critical: st.critical,
        days: 0,
        plannedPct: planned,
        actualPct: actual
      });
    }
  }
  items.sort((a, b) => Number(b.critical) - Number(a.critical) || b.days - a.days);
  return {
    asOf,
    finish: schedule.finish,
    baselineFinish,
    delayDays,
    overThreshold: delayDays >= threshold,
    items,
    criticalAtRisk: items.filter((i) => i.critical).length
  };
}

// ../capabilities/scheduling/src/service.ts
var STATUSES = ["planned", "in_progress", "done", "blocked"];
var SchedulingService = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  empty() {
    return { tasks: [] };
  }
  addTask(plan, input) {
    if (input.plannedEnd < input.plannedStart) {
      throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
    }
    const task = {
      id: this.deps.idGen.next("task"),
      projectRef: input.projectRef,
      title: input.title,
      assignee: input.assignee,
      plannedStart: input.plannedStart,
      plannedEnd: input.plannedEnd,
      status: "planned",
      progressPct: 0,
      milestone: input.milestone ?? false,
      durationDays: input.durationDays,
      earliestStart: input.earliestStart,
      sourceRef: input.sourceRef
    };
    return { ...plan, tasks: [...plan.tasks, task] };
  }
  /**
   * Remove a task and every dependency that touched it. The cleanup is the
   * point: a dependency left pointing at a deleted task makes the next
   * schedule throw, so deletion has to be a single operation the engine owns
   * rather than two the caller must remember to pair.
   */
  removeTask(plan, taskId) {
    if (!plan.tasks.some((t) => t.id === taskId)) {
      throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
    }
    return {
      ...plan,
      tasks: plan.tasks.filter((t) => t.id !== taskId),
      dependencies: (plan.dependencies ?? []).filter(
        (d) => d.predecessorId !== taskId && d.successorId !== taskId
      )
    };
  }
  renameTask(plan, taskId, title) {
    const clean = title.trim();
    if (!clean) throw new FactoryError("INVALID_STATE", "A task needs a title.");
    return this.mutate(plan, taskId, (t) => ({ ...t, title: clean }));
  }
  setStatus(plan, taskId, status) {
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      status,
      progressPct: status === "done" ? 100 : t.progressPct
    }));
  }
  /**
   * Record how far a task has got — and WHEN it got there.
   *
   * The observation is appended to the plan's progress log as well as written
   * onto the task, because the two answer different questions. The task
   * answers "where is this now", which is all a chart needs; the log answers
   * "where was this in March", which nothing can reconstruct afterwards and
   * which the actual-progress curve is entirely made of. One entry per task
   * per day: correcting today's figure replaces today's entry rather than
   * leaving a trail of keystrokes in the record.
   */
  setProgress(plan, taskId, pct2, asOf) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct2)));
    const date = asOf ?? this.deps.clock.todayIso();
    const next = this.mutate(plan, taskId, (t) => ({
      ...t,
      progressPct: clamped,
      status: clamped === 100 ? "done" : t.status === "planned" ? "in_progress" : t.status
    }));
    const log = (next.progressLog ?? []).filter((e) => !(e.taskId === taskId && e.date === date));
    return {
      ...next,
      progressLog: [...log, { taskId, date, pct: clamped }].sort(
        (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      )
    };
  }
  reschedule(plan, taskId, plannedStart, plannedEnd) {
    if (plannedEnd < plannedStart)
      throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
    return this.mutate(plan, taskId, (t) => ({ ...t, plannedStart, plannedEnd }));
  }
  /* ---------------------------------------------------------------------
     Network: calendar, dependencies, and the recalculation they drive.
     Every one of these returns a new Plan — the capability stays pure and
     the host owns persistence.
     --------------------------------------------------------------------- */
  /** Replace the working calendar. Durations are re-read against it on the next pass. */
  setCalendar(plan, calendar) {
    if (!calendar.workingWeekdays.length) {
      throw new FactoryError("INVALID_STATE", "A calendar needs at least one working weekday.");
    }
    return { ...plan, calendar };
  }
  /**
   * Tie two tasks together. The link is rejected if it would close a cycle —
   * checked by scheduling the result, so the answer comes from the same code
   * that would have to live with it.
   */
  link(plan, input) {
    const { predecessorId, successorId } = input;
    if (predecessorId === successorId) {
      throw new FactoryError("INVALID_STATE", "A task cannot depend on itself.");
    }
    for (const id of [predecessorId, successorId]) {
      if (!plan.tasks.some((t) => t.id === id)) {
        throw new FactoryError("NOT_FOUND", `Task ${id} not found.`);
      }
    }
    const deps = plan.dependencies ?? [];
    const type = input.type ?? "FS";
    if (deps.some(
      (d) => d.predecessorId === predecessorId && d.successorId === successorId && d.type === type
    )) {
      throw new FactoryError(
        "INVALID_STATE",
        `Those two tasks are already linked ${type}; edit the existing dependency instead.`
      );
    }
    const dep = {
      id: this.deps.idGen.next("dep"),
      predecessorId,
      successorId,
      type,
      lagDays: Math.round(input.lagDays ?? 0)
    };
    const next = { ...plan, dependencies: [...deps, dep] };
    computeSchedule(next);
    return next;
  }
  unlink(plan, dependencyId) {
    const deps = plan.dependencies ?? [];
    if (!deps.some((d) => d.id === dependencyId)) {
      throw new FactoryError("NOT_FOUND", `Dependency ${dependencyId} not found.`);
    }
    return { ...plan, dependencies: deps.filter((d) => d.id !== dependencyId) };
  }
  /** Change how long a task takes, in working days. Milestones stay at zero. */
  setDuration(plan, taskId, durationDays) {
    if (durationDays < 0) {
      throw new FactoryError("INVALID_STATE", "Duration cannot be negative.");
    }
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      durationDays: t.milestone ? 0 : Math.round(durationDays)
    }));
  }
  /**
   * Pin a task to a date — what dragging a bar means. It becomes a
   * start-no-earlier-than constraint rather than a fixed date, so the task
   * still moves if a predecessor pushes it later; it simply stops drifting
   * earlier than the date a human chose.
   */
  moveTask(plan, taskId, start) {
    return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: start }));
  }
  /** Drop the pin and let the task float back to its earliest possible date. */
  unpin(plan, taskId) {
    return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: void 0 }));
  }
  /** Both CPM passes: dates, floats and the critical path. Does not mutate. */
  schedule(plan, from) {
    return computeSchedule(plan, { from });
  }
  /**
   * Rewrite every task's planned dates from the schedule. This is what makes
   * the plan's finish move on its own when a task is dragged, a duration
   * changes or a link is added.
   */
  recalculate(plan, from) {
    return applySchedule(plan, computeSchedule(plan, { from }));
  }
  /** The plan's finish — the date the last task ends. */
  finishDate(plan, from) {
    return computeSchedule(plan, { from }).finish;
  }
  /** Tasks with no float, in dependency order. */
  criticalPath(plan, from) {
    const ids = computeSchedule(plan, { from }).criticalPath;
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }
  /* ---------------------------------------------------------------------
     Baselines
     --------------------------------------------------------------------- */
  /** Freeze the plan under a label — approval, contract signature, revision. */
  freezeBaseline(plan, label, asOf) {
    return freezeBaseline(plan, {
      id: this.deps.idGen.next("bl"),
      label,
      frozenAt: asOf ?? this.deps.clock.todayIso()
    });
  }
  /** Current dates against a frozen baseline, in working days. */
  compareToBaseline(plan, baselineId) {
    return compareToBaseline(plan, baselineId);
  }
  /** Tasks past their planned end and not done, soonest end first. */
  overdue(plan, asOf) {
    const today = asOf ?? this.deps.clock.todayIso();
    return plan.tasks.filter((t) => t.status !== "done" && t.plannedEnd < today).sort((a, b) => a.plannedEnd < b.plannedEnd ? -1 : 1);
  }
  /* ---------------------------------------------------------------------
     Derivation and tracking
     --------------------------------------------------------------------- */
  /**
   * A plan derived from a work breakdown, already put through the network so
   * its dates are the scheduled ones rather than the first-pass layout.
   *
   * `previous` is the plan being replaced, if any: progress, pinned dates and
   * frozen baselines are carried across for every task that survived the
   * re-derivation. Without that, re-deriving after a quote change would quietly
   * throw away everything the site had recorded.
   */
  fromWorkBreakdown(items, options, previous) {
    const derived = planFromWorkBreakdown(items, options);
    const merged = previous ? mergeDerivedPlan(previous, derived.plan) : derived.plan;
    return { ...derived, plan: this.recalculate(merged, options.from) };
  }
  /** Planned vs actual vs projected, over time. */
  progressCurve(plan, options) {
    return progressCurve(plan, computeSchedule(plan), {
      ...options,
      asOf: options.asOf || this.deps.clock.todayIso()
    });
  }
  /** Which tasks are late, by how much, and whether the slip crosses the line. */
  riskReport(plan, options) {
    return riskReport(plan, computeSchedule(plan), {
      ...options,
      asOf: options.asOf || this.deps.clock.todayIso()
    });
  }
  byAssignee(plan, assignee) {
    return plan.tasks.filter((t) => t.assignee === assignee);
  }
  summary(plan) {
    return STATUSES.map((status) => ({
      status,
      count: plan.tasks.filter((t) => t.status === status).length
    }));
  }
  mutate(plan, taskId, fn) {
    const idx = plan.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
    return { ...plan, tasks: plan.tasks.map((t, i) => i === idx ? fn(t) : t) };
  }
};

// ../capabilities/reconciliation/src/model.ts
var RECONCILIATION_DEFAULTS = {
  dateToleranceDays: 7,
  amountToleranceCents: 50,
  autoAcceptScore: 0.8,
  maxCombinationSize: 3,
  maxSuggestions: 5
};
function resolveReconciliationConfig(partial) {
  const num = (v, fallback, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const d = RECONCILIATION_DEFAULTS;
  return {
    dateToleranceDays: num(partial?.dateToleranceDays, d.dateToleranceDays, 0, 180),
    amountToleranceCents: num(partial?.amountToleranceCents, d.amountToleranceCents, 0, 1e5),
    autoAcceptScore: num(partial?.autoAcceptScore, d.autoAcceptScore, 0, 1),
    maxCombinationSize: num(partial?.maxCombinationSize, d.maxCombinationSize, 1, 6),
    maxSuggestions: num(partial?.maxSuggestions, d.maxSuggestions, 1, 50)
  };
}

// ../capabilities/reconciliation/src/match.ts
var W_AMOUNT_EXACT = 0.45;
var W_AMOUNT_NEAR = 0.3;
var W_DATE_SAME = 0.2;
var W_DATE_NEAR = 0.12;
var W_REFERENCE = 0.3;
var W_COUNTERPARTY = 0.15;
var clamp01 = (n) => Math.max(0, Math.min(1, n));
var round2 = (n) => Math.round(n * 100) / 100;
function daysBetween(a, b) {
  const ms = Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z");
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 864e5)) : Number.MAX_SAFE_INTEGER;
}
function normalise(text) {
  return String(text ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "");
}
function referenceQuoted(movementText, reference) {
  if (!reference) return false;
  const ref = normalise(reference);
  if (ref.length < 4) return false;
  return normalise(movementText).includes(ref);
}
function counterpartyNamed(movementText, counterparty) {
  if (!counterparty) return false;
  const haystack = normalise(movementText);
  const words = counterparty.split(/\s+/).map(normalise).filter((w) => w.length > 3);
  if (!words.length) return false;
  return words.some((w) => haystack.includes(w));
}
function directionAgrees(movement, doc) {
  return movement.amountCents < 0 ? doc.direction === "out" : doc.direction === "in";
}
var openAmount = (doc) => typeof doc.outstandingCents === "number" ? doc.outstandingCents : doc.amountCents;
function score(movement, docs, config) {
  if (!docs.length) return null;
  if (!docs.every((d) => directionAgrees(movement, d))) return null;
  const reasons = ["directionAgrees"];
  const target = Math.abs(movement.amountCents);
  const total = docs.reduce((s, d) => s + openAmount(d), 0);
  const differenceCents = target - total;
  const gap = Math.abs(differenceCents);
  let points = 0;
  if (gap === 0) {
    points += W_AMOUNT_EXACT;
    reasons.push("exactAmount");
  } else if (gap <= config.amountToleranceCents) {
    points += W_AMOUNT_NEAR;
    reasons.push("amountWithinTolerance");
  } else {
    return null;
  }
  const nearestDays = Math.min(...docs.map((d) => daysBetween(movement.date, d.date)));
  if (nearestDays === 0) {
    points += W_DATE_SAME;
    reasons.push("sameDate");
  } else if (nearestDays <= config.dateToleranceDays) {
    points += W_DATE_NEAR * (1 - nearestDays / (config.dateToleranceDays + 1));
    reasons.push("dateWithinTolerance");
  }
  if (docs.some((d) => referenceQuoted(movement.text, d.reference))) {
    points += W_REFERENCE;
    reasons.push("referenceQuoted");
  }
  if (docs.some((d) => counterpartyNamed(movement.text, d.counterparty))) {
    points += W_COUNTERPARTY;
    reasons.push("counterpartyNamed");
  }
  return {
    movementId: movement.id,
    docIds: docs.map((d) => d.id),
    confidence: round2(clamp01(points)),
    reasons,
    differenceCents,
    combination: docs.length > 1
  };
}
function* subsets(docs, maxSize) {
  const n = docs.length;
  for (let size = 2; size <= Math.min(maxSize, n); size++) {
    const idx = Array.from({ length: size }, (_, i) => i);
    for (; ; ) {
      yield idx.map((i) => docs[i]);
      let k = size - 1;
      while (k >= 0 && idx[k] === n - size + k) k--;
      if (k < 0) break;
      idx[k]++;
      for (let j = k + 1; j < size; j++) idx[j] = idx[j - 1] + 1;
    }
  }
}
function suggestMatches(movement, candidates, config) {
  const open = candidates.filter((d) => openAmount(d) > 0);
  const singles = [];
  for (const doc of open) {
    const s = score(movement, [doc], config);
    if (s) singles.push(s);
  }
  const combos = [];
  if (config.maxCombinationSize > 1) {
    const combinable = open.filter((d) => directionAgrees(movement, d)).filter((d) => openAmount(d) < Math.abs(movement.amountCents)).slice(0, 24);
    for (const subset of subsets(combinable, config.maxCombinationSize)) {
      const s = score(movement, subset, config);
      if (s) combos.push(s);
    }
  }
  return [...singles, ...combos].sort(
    (a, b) => b.confidence - a.confidence || a.docIds.length - b.docIds.length || Math.abs(a.differenceCents) - Math.abs(b.differenceCents)
  ).slice(0, config.maxSuggestions);
}
function suggestForAll(movements, candidates, config) {
  const out = {};
  for (const m of movements) {
    const s = suggestMatches(m, candidates, config);
    if (s.length) out[m.id] = s;
  }
  return out;
}
function findInternalTransfers(movements, config) {
  const outs = movements.filter((m) => m.amountCents < 0);
  const ins = movements.filter((m) => m.amountCents > 0);
  const taken = /* @__PURE__ */ new Set();
  const found = [];
  for (const out of outs) {
    let best2 = null;
    for (const inc of ins) {
      if (taken.has(inc.id)) continue;
      if (out.accountRef && inc.accountRef && out.accountRef === inc.accountRef) continue;
      if (Math.abs(Math.abs(out.amountCents) - inc.amountCents) > config.amountToleranceCents)
        continue;
      const days = daysBetween(out.date, inc.date);
      if (days > config.dateToleranceDays) continue;
      if (!best2 || days < best2.days) best2 = { mv: inc, days };
    }
    if (best2) {
      taken.add(best2.mv.id);
      found.push({
        outMovementId: out.id,
        inMovementId: best2.mv.id,
        amountCents: Math.abs(out.amountCents),
        daysApart: best2.days
      });
    }
  }
  return found;
}

// ../capabilities/messaging/src/rules.ts
var COMMS_RULE_DEFAULTS = {
  recipient: "customer",
  afterDays: 0,
  channel: "email",
  mode: "draft",
  active: true
};
function resolveRule(rule) {
  return {
    id: rule.id,
    label: rule.label,
    event: rule.event,
    template: rule.template,
    recipient: rule.recipient ?? COMMS_RULE_DEFAULTS.recipient,
    afterDays: rule.afterDays ?? COMMS_RULE_DEFAULTS.afterDays,
    channel: rule.channel ?? COMMS_RULE_DEFAULTS.channel,
    mode: rule.mode ?? COMMS_RULE_DEFAULTS.mode,
    requiresFlag: rule.requiresFlag,
    active: rule.active ?? COMMS_RULE_DEFAULTS.active
  };
}
function addDays(dateIso, days) {
  const d = /* @__PURE__ */ new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function planMessages(rules, events, options) {
  const planned = [];
  for (const event of events) {
    for (const raw of rules) {
      const rule = resolveRule(raw);
      if (!rule.active) continue;
      if (rule.event !== event.event) continue;
      if (rule.requiresFlag && !event.flags?.[rule.requiresFlag]) continue;
      const dueDate = addDays(event.date, rule.afterDays);
      const to = event.recipients?.[rule.recipient] ?? null;
      planned.push({
        ruleId: rule.id,
        event: rule.event,
        subjectRef: event.subjectRef,
        template: rule.template,
        recipient: rule.recipient,
        to,
        channel: rule.channel,
        dueDate,
        mode: rule.mode,
        vars: event.vars ?? {},
        due: dueDate <= options.asOf,
        ...to ? {} : { blocked: "noRecipient" }
      });
    }
  }
  return planned.sort(
    (a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0)
  );
}
function newMessages(planned, existing) {
  const seen = new Set(existing);
  return planned.filter((p) => !seen.has(`${p.ruleId}|${p.subjectRef}`));
}
function messageKey(m) {
  return `${m.ruleId}|${m.subjectRef}`;
}

// ../capabilities/messaging/src/service.ts
function renderTemplate(tpl, vars) {
  return tpl.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_m, key) => key in vars ? String(vars[key]) : `{{${key}}}`
  );
}

// ../capabilities/projects/src/forecast.ts
var bp = (part, whole) => whole === 0 ? 0 : roundDivHalfUp(part * 1e4, Math.abs(whole));
var DEFAULT_OVERRUN_THRESHOLD_BP = 1e3;
var DEFAULT_MIN_PROGRESS_PCT = 10;
function calculatedFor(budgetCents, committedCents, actualCents, progressPct) {
  const floor = Math.max(actualCents, committedCents);
  if (actualCents <= 0) return Math.max(budgetCents, floor);
  if (progressPct >= 100) return actualCents;
  if (progressPct <= 0) return Math.max(budgetCents, floor);
  const extrapolated = roundDivHalfUp(actualCents * 100, progressPct);
  return Math.max(extrapolated, floor);
}
function forecastToCompletion(project, input) {
  const threshold = input.overrunThresholdBp ?? DEFAULT_OVERRUN_THRESHOLD_BP;
  const minProgress = input.minProgressPct ?? DEFAULT_MIN_PROGRESS_PCT;
  const progressBy = new Map(input.progress.map((p) => [p.chapter, p.progressPct]));
  const overrideBy = new Map((input.overrides ?? []).map((o) => [o.chapter, o]));
  const chapters = /* @__PURE__ */ new Set([
    ...project.baselineByChapter.map((c) => c.chapter),
    ...project.costs.map((c) => c.chapter),
    ...project.changeOrders.filter((c) => c.status === "approved").map((c) => c.chapter)
  ]);
  const byChapter = [...chapters].map((chapter) => {
    const baseline = project.baselineByChapter.find((c) => c.chapter === chapter)?.budgetCents ?? 0;
    const approved = project.changeOrders.filter((c) => c.status === "approved" && c.chapter === chapter).reduce((s, c) => s + c.deltaCents, 0);
    const budgetCents2 = baseline + approved;
    const committedCents = project.costs.filter((c) => c.kind === "committed" && c.chapter === chapter).reduce((s, c) => s + c.amountCents, 0);
    const actualCents = project.costs.filter((c) => c.kind === "actual" && c.chapter === chapter).reduce((s, c) => s + c.amountCents, 0);
    const progressPct = Math.max(0, Math.min(100, progressBy.get(chapter) ?? 0));
    const calculatedCents = calculatedFor(budgetCents2, committedCents, actualCents, progressPct);
    const override = overrideBy.get(chapter);
    const usable = override && override.reason.trim() ? override : void 0;
    const adjustedCents = usable ? usable.costCents : null;
    const forecastCents2 = adjustedCents ?? calculatedCents;
    const varianceCents2 = forecastCents2 - budgetCents2;
    return {
      chapter,
      budgetCents: budgetCents2,
      committedCents,
      actualCents,
      progressPct,
      calculatedCents,
      adjustedCents,
      adjustmentReason: usable ? usable.reason : null,
      forecastCents: forecastCents2,
      varianceCents: varianceCents2,
      varianceBp: bp(varianceCents2, budgetCents2),
      provisional: progressPct > 0 && progressPct < minProgress && adjustedCents === null
    };
  });
  const total = (pick) => byChapter.reduce((s, c) => s + pick(c), 0);
  const budgetCents = total((c) => c.budgetCents);
  const forecastCents = total((c) => c.forecastCents);
  const varianceCents = forecastCents - budgetCents;
  const revenueCents = project.revenueCents;
  const marginForecastCents = revenueCents - forecastCents;
  return {
    byChapter,
    budgetCents,
    committedCents: total((c) => c.committedCents),
    actualCents: total((c) => c.actualCents),
    calculatedCents: total((c) => c.calculatedCents),
    forecastCents,
    varianceCents,
    varianceBp: bp(varianceCents, budgetCents),
    revenueCents,
    marginForecastCents,
    marginForecastBp: bp(marginForecastCents, revenueCents || budgetCents),
    overrunChapters: byChapter.filter((c) => c.varianceCents > 0 && c.varianceBp >= threshold).sort((a, b) => b.varianceBp - a.varianceBp).map((c) => c.chapter)
  };
}

// ../capabilities/projects/src/service.ts
var bp2 = (part, whole) => whole === 0 ? 0 : roundDivHalfUp(part * 1e4, Math.abs(whole));
var ProjectsService = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  /**
   * Create a project from an accepted quote WITHOUT re-entering figures. The
   * chapter budgets and total are copied once and then frozen (PRJ baseline).
   */
  fromAcceptedQuote(input) {
    if (input.baselineByChapter.length === 0) {
      throw new FactoryError(
        "INVALID_STATE",
        "A project needs at least one chapter budget from the quote."
      );
    }
    const baselineCents = sumCents(input.baselineByChapter.map((c) => c.budgetCents));
    return {
      id: this.deps.idGen.next("prj"),
      name: input.name,
      customerRef: input.customerRef,
      sourceQuoteId: input.sourceQuoteId,
      baselineCents,
      baselineByChapter: input.baselineByChapter.map((c) => ({ ...c })),
      revenueCents: 0,
      costs: [],
      changeOrders: [],
      status: "active",
      createdAt: this.deps.clock.nowIso()
    };
  }
  bookCost(project, input) {
    this.assertActive(project);
    const entry = {
      id: this.deps.idGen.next("cost"),
      kind: input.kind,
      chapter: input.chapter,
      description: input.description,
      amountCents: input.amountCents,
      date: this.deps.clock.todayIso(),
      ref: input.ref
    };
    return { ...project, costs: [...project.costs, entry] };
  }
  recordRevenue(project, amountCents) {
    this.assertActive(project);
    return { ...project, revenueCents: project.revenueCents + amountCents };
  }
  /** Raise a change order (proposed). The baseline is never touched. */
  proposeChange(project, input) {
    this.assertActive(project);
    const co = {
      id: this.deps.idGen.next("chg"),
      chapter: input.chapter,
      description: input.description,
      deltaCents: input.deltaCents,
      status: "proposed",
      date: this.deps.clock.todayIso()
    };
    return { ...project, changeOrders: [...project.changeOrders, co] };
  }
  decideChange(project, changeId, approve) {
    const idx = project.changeOrders.findIndex((c) => c.id === changeId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Change order ${changeId} not found.`);
    if (project.changeOrders[idx].status !== "proposed") {
      throw new FactoryError("INVALID_STATE", `Change order ${changeId} is already decided.`);
    }
    const changeOrders = project.changeOrders.map(
      (c, i) => i === idx ? { ...c, status: approve ? "approved" : "rejected" } : c
    );
    return { ...project, changeOrders };
  }
  close(project) {
    return { ...project, status: "closed" };
  }
  /** The financial truth: budget vs committed vs actual vs revenue, margin,
   *  forecast, and quoted-vs-actual per chapter. */
  financials(project) {
    const approvedChangesCents = sumCents(
      project.changeOrders.filter((c) => c.status === "approved").map((c) => c.deltaCents)
    );
    const currentBudgetCents = project.baselineCents + approvedChangesCents;
    const committedCents = sumCents(
      project.costs.filter((c) => c.kind === "committed").map((c) => c.amountCents)
    );
    const actualCents = sumCents(
      project.costs.filter((c) => c.kind === "actual").map((c) => c.amountCents)
    );
    const marginCents = project.revenueCents - actualCents;
    const forecastProfitCents = currentBudgetCents - Math.max(actualCents, committedCents);
    const marginBp = bp2(marginCents, project.revenueCents || currentBudgetCents);
    const marginBelowFloor = project.revenueCents > 0 && marginBp < this.deps.config.marginFloorBp;
    return {
      baselineCents: project.baselineCents,
      approvedChangesCents,
      currentBudgetCents,
      committedCents,
      actualCents,
      revenueCents: project.revenueCents,
      marginCents,
      marginBp,
      forecastProfitCents,
      marginBelowFloor,
      byChapter: this.marginByChapter(project)
    };
  }
  /**
   * Where the cost is heading, not where it has got to. `financials()` reports
   * what has happened; this reports what it implies — see forecast.ts for why
   * the two are different questions and why both are worth showing.
   */
  forecast(project, input) {
    return forecastToCompletion(project, input);
  }
  /** Per-chapter budget vs committed vs actual + variance (the core pain). */
  marginByChapter(project) {
    const chapters = /* @__PURE__ */ new Set([
      ...project.baselineByChapter.map((c) => c.chapter),
      ...project.costs.map((c) => c.chapter),
      ...project.changeOrders.filter((c) => c.status === "approved").map((c) => c.chapter)
    ]);
    return [...chapters].map((chapter) => {
      const baseline = project.baselineByChapter.find((c) => c.chapter === chapter)?.budgetCents ?? 0;
      const approved = sumCents(
        project.changeOrders.filter((c) => c.status === "approved" && c.chapter === chapter).map((c) => c.deltaCents)
      );
      const budgetCents = baseline + approved;
      const committedCents = sumCents(
        project.costs.filter((c) => c.kind === "committed" && c.chapter === chapter).map((c) => c.amountCents)
      );
      const actualCents = sumCents(
        project.costs.filter((c) => c.kind === "actual" && c.chapter === chapter).map((c) => c.amountCents)
      );
      const varianceCents = actualCents - budgetCents;
      return {
        chapter,
        budgetCents,
        committedCents,
        actualCents,
        varianceCents,
        varianceBp: bp2(varianceCents, budgetCents)
      };
    });
  }
  assertActive(project) {
    if (project.status !== "active") {
      throw new FactoryError("INVALID_STATE", `Project ${project.id} is closed.`);
    }
  }
};

// ../packs/vertical-construction-reformas/src/rates.ts
var DAILY_OUTPUT_BY_UNIT = {
  m2: 20,
  "m\xB2": 20,
  m3: 6,
  "m\xB3": 6,
  m: 40,
  ml: 40,
  ud: 4,
  u: 4,
  pa: 1,
  // a lump sum has no quantity to speak of; it takes a day unless told otherwise
  PA: 1,
  h: 8,
  kg: 200,
  l: 200
};
var DAILY_OUTPUT_BY_CHAPTER = {
  "Demoliciones y trabajos previos": { m2: 30, "m\xB2": 30, m3: 8, "m\xB3": 8 },
  Estructura: { m2: 8, "m\xB2": 8, m3: 3, "m\xB3": 3 },
  "Alba\xF1iler\xEDa y tabiquer\xEDa": { m2: 12, "m\xB2": 12 },
  "Revestimientos y acabados": { m2: 14, "m\xB2": 14 },
  "Aparatos sanitarios": { ud: 3, u: 3 },
  "Carpinter\xEDa interior": { ud: 3, u: 3 },
  "Carpinter\xEDa exterior": { ud: 2, u: 2 },
  Cocina: { ud: 1, u: 1, ml: 3, m: 3 },
  Pintura: { m2: 60, "m\xB2": 60 },
  "Instalaci\xF3n el\xE9ctrica": { ud: 8, u: 8, m2: 25, "m\xB2": 25 },
  Climatizaci\u00F3n: { ud: 1, u: 1 },
  Ventilaci\u00F3n: { ud: 2, u: 2, ml: 20, m: 20 },
  Fontaner\u00EDa: { ud: 3, u: 3, ml: 15, m: 15 },
  Saneamiento: { ud: 3, u: 3, ml: 15, m: 15 },
  Telecomunicaciones: { ud: 8, u: 8 },
  "Protecci\xF3n contra incendios": { ud: 6, u: 6 }
};
function dailyOutputFor(lookup) {
  const unit = (lookup.unit ?? "").trim();
  if (!unit) return null;
  const sources = [
    lookup.chapter ? lookup.overridesByChapter?.[lookup.chapter] : void 0,
    lookup.chapter ? DAILY_OUTPUT_BY_CHAPTER[lookup.chapter] : void 0,
    lookup.overridesByUnit,
    DAILY_OUTPUT_BY_UNIT
  ];
  for (const table of sources) {
    const rate = table?.[unit];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) return rate;
  }
  return null;
}

// src/index.ts
var BrowserIdGen = class {
  counter = 0;
  next(prefix) {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}_${uuid}`;
    this.counter += 1;
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}${this.counter.toString(36)}${rand}`;
  }
};
function defaultPorts() {
  return { clock: new SystemClock(), idGen: new BrowserIdGen() };
}
function createScheduling(ports = defaultPorts()) {
  const svc = new SchedulingService({
    clock: ports.clock,
    idGen: ports.idGen,
    config: {}
  });
  return {
    /** An empty plan value — callers own persistence, as capabilities are pure. */
    empty() {
      return svc.empty();
    },
    /** Count of tasks per status, in a fixed status order. */
    summary(plan) {
      return svc.summary(plan);
    },
    /** Not-done tasks past their planned end, soonest first. */
    overdue(plan, asOf) {
      return svc.overdue(plan, asOf);
    },
    /**
     * Calendar arithmetic, exposed because a chart genuinely needs it: to
     * shade the closed days on its axis and to convert a pixel drag into a
     * date. Without this the view would reimplement working-day maths beside
     * the engine that owns it, and the two would drift apart on the first
     * closure someone adds.
     */
    calendar: {
      everyDay: everyDayCalendar,
      isWorkingDay,
      addWorkingDays,
      workingDaysInclusive,
      workingDayOffset
    },
    service: svc
  };
}
function createProjects(ports = defaultPorts()) {
  const svc = new ProjectsService({
    clock: ports.clock,
    idGen: ports.idGen,
    config: { marginFloorBp: 1200 }
  });
  return {
    /** Where the cost is heading, per chapter and in total. */
    forecast(project, input) {
      return forecastToCompletion(project, input);
    },
    service: svc
  };
}
function createRates() {
  return {
    /** Daily output for a line, or null when nothing in the tables applies. */
    dailyOutputFor(lookup) {
      return dailyOutputFor(lookup);
    }
  };
}
function createReconciliation(config) {
  const cfg = resolveReconciliationConfig(config);
  return {
    config: cfg,
    /** What might explain one movement, best first. */
    suggest(movement, candidates) {
      return suggestMatches(movement, candidates, cfg);
    },
    /** The same for a whole statement, keyed by movement id. */
    suggestAll(movements, candidates) {
      return suggestForAll(movements, candidates, cfg);
    },
    /** Pairs that are one transfer between the tenant's own accounts. */
    internalTransfers(movements) {
      return findInternalTransfers(movements, cfg);
    }
  };
}
function createComms() {
  return {
    /** Fill `{{tokens}}`; unknown ones are left visible rather than blanked. */
    render(template, vars) {
      return renderTemplate(template, vars);
    },
    /** What the rules say should be queued, given what has happened. */
    plan(rules, events, asOf) {
      return planMessages(rules, events, { asOf });
    },
    /** Drop anything the caller has already queued, sent or cancelled. */
    unseen(planned, existingKeys) {
      return newMessages(planned, existingKeys);
    },
    /** The de-duplication key, exported so callers cannot drift from it. */
    key: messageKey
  };
}
function createExtraction(config) {
  const ports = new PortRegistry();
  ports.bind(EXTRACTION_PROFILE_PORT, ES_EXTRACTION_PROFILE, "pack/jurisdiction-es-es");
  const svc = new ExtractionService({
    ports,
    config: extractionConfigSchema.parse(config ?? {})
  });
  return {
    /** Recognised text in, candidate fields with dots and provenance out. */
    read(text, assumeIssueDate) {
      return svc.extract({ text, assumeIssueDate });
    },
    /**
     * Re-run the checks over values a person has edited. The screen calls this
     * on every correction so the dots and the arithmetic move together — and
     * so a typed value is re-checked rather than merely believed.
     */
    recheck(result, corrections) {
      return svc.recheck(result, corrections);
    },
    /** The profile actually bound, for a screen that wants to say so. */
    profile() {
      return { id: ES_EXTRACTION_PROFILE.id, version: ES_EXTRACTION_PROFILE.version };
    }
  };
}
function createDocs() {
  return {
    /** Fills in the defaults and pulls out-of-range values back into range. */
    annexOptions(raw) {
      return resolveAnnexOptions(raw);
    },
    /** Lays the given images out as annex pages, in document order. */
    compose(images, options) {
      return composeAnnex(images, options);
    }
  };
}
var SURFACE_VERSION = 7;
