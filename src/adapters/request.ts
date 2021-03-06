/*
 * @Author: youzhao.zhou
 * @Date: 2021-02-04 16:09:10
 * @Last Modified by: youzhao.zhou
 * @Last Modified time: 2021-02-25 14:02:38
 * @Description request adapter
 *
 * 1. 执行成功需要返回IAppletsRequestResponse，执行失败即为reject返回IAppletsRequestAdapterError
 * 2. 如果取消返回IAppletsRequest.ICanceler
 */

import { merge } from "../helpers/utils";
import getAdapterReqConfig from "./getReqConfig";
import getRequestAdapter from "./getRequestAdapter";
import getRequestSuccess from "./getRequestSuccess";

export default function request(
  config: IAppletsRequest.IHttpConfig
): IAppletsRequestPromise {
  /**
   * 获取错误类型
   * @param err
   * @param timeout
   * @returns NETWORK_ERROR | TIMEOUT
   * @example {
   *    msg: `Timeout of 2000 ms exceeded`,
   *    type: "TIMEOUT",
   *  }
   */
  function failType(
    err: any,
    timeout: number | undefined
  ): { msg: string; type: "NETWORK_ERROR" | "TIMEOUT" } {
    if (
      err &&
      (err.errMsg || "").toString().toLowerCase().includes("timeout")
    ) {
      return {
        msg: `Timeout of ${timeout || ""} ms exceeded`,
        type: "TIMEOUT",
      };
    }
    return {
      msg: `Network Error`,
      type: "NETWORK_ERROR",
    };
  }

  function getReqConfig(
    originalConfig: IAppletsRequest.IHttpConfig
  ): IAppletsRequest.IHttpConfig {
    const tmpConfig: any = merge({}, originalConfig);
    tmpConfig.headers = originalConfig.headers;
    delete tmpConfig.header;
    delete tmpConfig.Adapter;
    return tmpConfig;
  }

  return new Promise((resolve, reject) => {
    const Adapter = config.Adapter;
    const reqConfig = getAdapterReqConfig(config);
    const adapterConfig = getReqConfig(config);

    if (!Adapter) {
      throw new TypeError("Adapter is undefined or null");
    }

    const adapter = new Adapter(adapterConfig);

    let requestor = getRequestAdapter()({
      ...reqConfig,
      success(res: any) {
        adapter.resolve(getRequestSuccess(res), resolve);
      },
      fail(err: any) {
        const errData = failType(err, reqConfig.timeout);
        const rejectData = {
          errMsg: errData.msg,
          status: errData.type,
          extra: err,
        };

        adapter.reject(rejectData, reject);
      },
      complete() {
        requestor = null;
      },
    });

    adapter.subscribeCancelEvent((reason) => {
      reject(reason);
      requestor.abort();
      requestor = null;
    });

    if (typeof config.getRequestTask === "function") {
      config.getRequestTask(request);
    }
  });
}
