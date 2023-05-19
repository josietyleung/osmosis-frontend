import {
  CosmosQueries,
  IAccountStore,
  IQueriesStore,
} from "@keplr-wallet/stores";
import {
  ChainStore,
  DerivedDataStore as BaseDerivedDataStore,
  IPriceStore,
  ObservableQueryActiveGauges,
  ObservableQueryPoolFeesMetrics,
  OsmosisQueries,
} from "@osmosis-labs/stores";
import { DeepReadonly } from "utility-types";

import { ObservableAssets } from "../assets";
import { UserSettings } from "../user-settings";
import {
  ObservablePoolsWithMetrics,
  ObservableVerifiedPoolsStoreMap,
} from "./pools";

/** Contains stores that compute on the lower level stores. */
export class DerivedDataStore extends BaseDerivedDataStore {
  public readonly poolsWithMetrics: DeepReadonly<ObservablePoolsWithMetrics>;
  public readonly verifiedPoolsStore: DeepReadonly<ObservableVerifiedPoolsStoreMap>;

  constructor(
    protected readonly osmosisChainId: string,
    protected readonly queriesStore: IQueriesStore<
      CosmosQueries & OsmosisQueries
    >,
    protected readonly externalQueries: {
      queryGammPoolFeeMetrics: ObservableQueryPoolFeesMetrics;
      queryActiveGauges: ObservableQueryActiveGauges;
    },
    protected readonly accountStore: IAccountStore,
    protected readonly priceStore: IPriceStore,
    protected readonly chainGetter: ChainStore,
    protected readonly assetStore: ObservableAssets,
    protected readonly userSettings: UserSettings
  ) {
    super(
      osmosisChainId,
      queriesStore,
      externalQueries,
      accountStore,
      priceStore,
      chainGetter
    );

    this.verifiedPoolsStore = new ObservableVerifiedPoolsStoreMap(
      this.osmosisChainId,
      this.queriesStore,
      this.assetStore
    );
    this.poolsWithMetrics = new ObservablePoolsWithMetrics(
      this.osmosisChainId,
      this.queriesStore,
      this.verifiedPoolsStore,
      this.poolDetails,
      this.poolsBonding,
      this.chainGetter,
      this.externalQueries,
      this.priceStore,
      this.userSettings
    );
  }
}
