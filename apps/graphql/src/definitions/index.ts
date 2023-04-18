import type { DocumentNode } from "graphql";

import * as Account from "./Account.js";
import * as Build from "./Build.js";
import * as Connection from "./Connection.js";
import * as DateDefs from "./Date.js";
import * as JobStatus from "./JobStatus.js";
import * as Node from "./Node.js";
import * as PageInfo from "./PageInfo.js";
import * as Permission from "./Permission.js";
import * as Plan from "./Plan.js";
import * as Purchase from "./Purchase.js";
import * as Repository from "./Repository.js";
import * as Screenshot from "./Screenshot.js";
import * as ScreenshotBucket from "./ScreenshotBucket.js";
import * as ScreenshotDiff from "./ScreenshotDiff.js";
import * as Test from "./Test.js";
import * as User from "./User.js";
import * as ValidationStatus from "./ValidationStatus.js";
import * as schema from "./schema.js";

export const definitions: { resolvers?: object; typeDefs?: DocumentNode }[] = [
  Account,
  Build,
  Connection,
  DateDefs,
  JobStatus,
  Node,
  PageInfo,
  Permission,
  Plan,
  Purchase,
  Repository,
  schema,
  Screenshot,
  ScreenshotBucket,
  ScreenshotDiff,
  Test,
  User,
  ValidationStatus,
];
