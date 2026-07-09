import { Context } from '../../ctx';
import { Operation, OperationMeta } from '../../definitions';
export default function execute(ctx: Context, op: Operation): Promise<void>;
export declare const OPS: OperationMeta;
