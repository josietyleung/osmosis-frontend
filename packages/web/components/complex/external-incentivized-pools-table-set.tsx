import { CoinPretty, Dec } from "@keplr-wallet/unit";
import { ObservablePool } from "@osmosis-labs/stores";
import { observer } from "mobx-react-lite";
import { FunctionComponent, useState } from "react";
import { ExtraGaugeInPool } from "../../config";
import { useExternalIncentivizedPoolsTable } from "../../hooks/use-external-incentivized-pools-table";
import { useStore } from "../../stores";
import { PageList, SortMenu } from "../control";
import { SearchBox } from "../input";
import { PoolTable } from "../table";

const TVL_FILTER_THRESHOLD = 1000;

export const ExternalIncentivizedPoolsTableSet: FunctionComponent = observer(
  () => {
    const {
      chainStore,
      queriesImperatorStore,
      priceStore,
      queriesOsmosisStore,
      accountStore,
    } = useStore();

    const chainInfo = chainStore.getChain("osmosis");
    const queryImperator = queriesImperatorStore.get();
    const queryOsmosis = queriesOsmosisStore.get(chainInfo.chainId);
    const account = accountStore.getAccount(chainInfo.chainId);

    const [isPoolTvlFiltered, setIsPoolTvlFiltered] = useState(false);

    const externalIncentivizedPools = Object.keys(ExtraGaugeInPool)
      .map((poolId: string) => {
        const pool = queryOsmosis.queryGammPools.getPool(poolId);
        if (pool) {
          return pool;
        }
      })
      .filter((pool: ObservablePool | undefined): pool is ObservablePool => {
        if (!pool) {
          return false;
        }

        const inner = ExtraGaugeInPool[pool.id];
        const data = Array.isArray(inner) ? inner : [inner];

        if (data.length === 0) {
          return false;
        }
        const gaugeIds = data.map((d) => d.gaugeId);
        const gauges = gaugeIds.map((gaugeId) =>
          queryOsmosis.queryGauge.get(gaugeId)
        );

        let maxRemainingEpoch = 0;
        for (const gauge of gauges) {
          if (maxRemainingEpoch < gauge.remainingEpoch) {
            maxRemainingEpoch = gauge.remainingEpoch;
          }
        }

        return maxRemainingEpoch > 0;
      });
    const externalIncentivizedPoolsWithMetrics = externalIncentivizedPools.map(
      (pool) => {
        const inner = ExtraGaugeInPool[pool.id];
        const data = Array.isArray(inner) ? inner : [inner];
        const gaugeIds = data.map((d) => d.gaugeId);
        const gauges = gaugeIds.map((gaugeId) => {
          return queryOsmosis.queryGauge.get(gaugeId);
        });
        const incentiveDenom = data[0].denom;
        const currency = chainStore
          .getChain(chainInfo.chainId)
          .forceFindCurrency(incentiveDenom);
        let sumRemainingBonus: CoinPretty = new CoinPretty(
          currency,
          new Dec(0)
        );
        let maxRemainingEpoch = 0;
        for (const gauge of gauges) {
          sumRemainingBonus = sumRemainingBonus.add(
            gauge.getRemainingCoin(currency)
          );

          if (gauge.remainingEpoch > maxRemainingEpoch) {
            maxRemainingEpoch = gauge.remainingEpoch;
          }
        }

        return {
          ...queryImperator.queryGammPoolMetrics.makePoolWithFeeMetrics(
            pool,
            priceStore,
            priceStore.getFiatCurrency("usd")!
          ),
          epochsRemaining: maxRemainingEpoch,
          myLiquidity: pool
            .computeTotalValueLocked(
              priceStore,
              priceStore.getFiatCurrency("usd")!
            )
            .mul(
              queryOsmosis.queryGammPoolShare.getAllGammShareRatio(
                account.bech32Address,
                pool.id
              )
            ),
          apr: queryOsmosis.queryIncentivizedPools
            .computeMostAPY(
              pool.id,
              priceStore,
              priceStore.getFiatCurrency("usd")!
            )
            .toString(),
        };
      }
    );

    const tvlFilteredPools = isPoolTvlFiltered
      ? externalIncentivizedPoolsWithMetrics
      : externalIncentivizedPoolsWithMetrics.filter((poolWithMetricss) =>
          poolWithMetricss.liquidity.toDec().gte(new Dec(TVL_FILTER_THRESHOLD))
        );

    const {
      query,
      setQuery,
      sortKeyPath,
      setSortKeyPath,
      toggleSortDirection,
      page,
      setPage,
      minPage,
      numPages,
      tableCols,
      tableRows,
      tableData,
    } = useExternalIncentivizedPoolsTable(tvlFilteredPools);

    return (
      <>
        <div className="mt-5 flex items-center justify-between">
          <h5>External Incentive Pools</h5>
          <div className="flex gap-8">
            <SearchBox
              currentValue={query}
              onInput={setQuery}
              placeholder="Search by pool id or tokens"
              className="!w-64"
            />
            <SortMenu
              options={tableCols}
              selectedOptionId={sortKeyPath}
              onSelect={(id) =>
                id === sortKeyPath ? setSortKeyPath("") : setSortKeyPath(id)
              }
              onToggleSortDirection={toggleSortDirection}
            />
          </div>
        </div>
        <PoolTable
          className="mt-5 w-full"
          columnDefs={tableCols}
          rowDefs={tableRows}
          data={tableData}
        />
        <div className="relative flex place-content-around">
          <PageList
            currentValue={page}
            max={numPages}
            min={minPage}
            onInput={setPage}
            editField
          />
          <label
            htmlFor="show-all-pools"
            className="absolute right-2 bottom-1 text-base flex items-center"
            onClick={() => setIsPoolTvlFiltered(!isPoolTvlFiltered)}
          >
            <input
              className="mr-2"
              id="show-all-pools"
              type="checkbox"
              checked={isPoolTvlFiltered}
            />
            Show pools less then $1,000 TVL
          </label>
        </div>
      </>
    );
  }
);
