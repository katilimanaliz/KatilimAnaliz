import { MobileProject } from '@trapezedev/project';
export interface Args {
    ios?: boolean;
    android?: boolean;
    [key: string]: any;
}
export interface Context {
    project: MobileProject;
    projectRootPath?: string;
    args: Args;
    vars: Variables;
    nodePackageRoot: string;
    rootDir: string;
}
export interface Variable {
    value?: string;
    defaultValue?: any;
    type?: VariableType;
}
export declare const enum VariableType {
    String = "string",
    Number = "number",
    Array = "array",
    Object = "object"
}
export interface Variables {
    [variable: string]: Variable;
}
export declare function loadContext(projectRootPath?: string, androidProject?: string, iosProject?: string): Promise<Context>;
export declare function initLogging(args: string[]): void;
export declare function setArguments(ctx: Context, args: any): void;
export declare function str(ctx: Context, s: string): string | any;
export declare function initVarsFromEnv(ctx: Context, vars: Variables): void;
