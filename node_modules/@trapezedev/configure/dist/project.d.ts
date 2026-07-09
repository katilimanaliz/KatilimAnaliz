import { MobileProject } from '@trapezedev/project';
import { Args } from './ctx';
export declare function loadProject(args: Args, projectRootPath?: string, androidProject?: string, iosProject?: string): Promise<MobileProject>;
