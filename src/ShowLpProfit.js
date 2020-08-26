import React, {useEffect, useState, useRef,} from 'react';

import {useQuery} from '@apollo/react-hooks'
import gql from 'graphql-tag'
import {rpcProxy} from './rpcClient'
//import ethers from 'ethers'
import {Token} from '@uniswap/sdk'
//import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json'
import ReactEcharts from 'echarts-for-react';
import {formatDate, parseDate} from './dateUtil'
import {movePointLeft} from './util'

let format = 'yyyy-MM-dd hh:mm:ss'
let config
let pairObjArr, address2name = {}, name2address = {}, address2Obj = {}

export function init(config_, pairObjArr_, address2name_, name2address_, address2Obj_) {
    config = config_
    pairObjArr = pairObjArr_
    address2name = address2name_
    name2address = name2address_
    address2Obj = address2Obj_

}


export function ProfitTrend() {
    //生成日期数组
    const dateArr = []
    for (let i = 0; i < 60; i++) {
        let today = new Date()
        today.setUTCDate(today.getUTCDate() - i)
        today.setUTCHours(0, 0, 0, 0)
        dateArr.push(today)
    }
    //console.log(formatDate(dateArr[dateArr.length - 1], format, 'utc'))
    const [queryParam, setQueryParam] = useState({
        userAddress: "0xb61d572d3f626c0e4cdffae8559ad838d839f229",
        pairAddress: "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852", //usdt-eth,
        beginDate: formatDate(dateArr[dateArr.length - 1], format, 'utc')
    })

    let userAddress = useRef()
    let pairAddress = useRef()
    let beginDate = useRef()

    const handleQuery = e => {
        const param = {
            userAddress: userAddress.current.value.toLowerCase(),
            pairAddress: pairAddress.current.value.toLowerCase(),
            beginDate: formatDate(new Date(parseInt(beginDate.current.value)), format, 'utc'),
        }
        if (param.pairAddress && param.beginDate && param.userAddress) {
            setQueryParam(param)
        } else {
            console.warn("参数格式不正确！" + param.pairAddress)
            alert("参数不正确！")
        }
    }

    //查询pair历史状态
    /*
    let stateArr=useRef()
    rpcProxy.queryPairState(queryParam.pairAddress, queryParam.beginDate).then(
        rows => stateArr=rows,
        e => console.error("queryPairState异常:" + e)
    )
    */
    //重复设置同一个值，不会导致重新渲染。但仅限于简单数据类型
    let [stateQuery, setStateQuery] = useState(null)
    if (!stateQuery || stateQuery.key !== queryParam.pairAddress + "_" + queryParam.beginDate) {
        rpcProxy.queryPairState(queryParam.pairAddress, queryParam.beginDate).then(
            rows => {//console.log(JSON.stringify(rows))
                setStateQuery({
                    key: queryParam.pairAddress + "_" + queryParam.beginDate,
                    stateArr: rows
                })
            },
            e => console.error("queryPairState异常:" + e)
        )
    }


    //查询用户当前持有的流动性代币数量
    //let userLiquidity = await new ethers.Contract(queryParam.pairAddress, IUniswapV2ERC20.abi, config.provider).balanceOf(config.userAddress)

    //查询用户的出入金情况。按时间倒序排列，只能查出1000条
    const USER_QUERY = gql`
query userPairState($pairAddress: Bytes!, $userAddress: Bytes!) {
  user(id:$userAddress){
    usdSwapped
    liquidityPositions(where:{pair: $pairAddress}){
      liquidityTokenBalance
      historicalSnapshots(first:1000,orderBy:timestamp, orderDirection:desc,){ # 查询数量不得超过一千。注意这里是倒序排列
        timestamp
        token0PriceUSD
        token1PriceUSD
        reserve0
        reserve1
        reserveUSD #资金池总价值
        liquidityTokenTotalSupply #流动性代币总量
        liquidityTokenBalance #当前用户的流动性代币的数量
      }
    }
  }

}
`

    const {loading: userLoading, error: userError, data: userPairState} = useQuery(USER_QUERY, {
        variables: {
            pairAddress: queryParam.pairAddress,
            userAddress: queryParam.userAddress,
        }
    })
    const user = userPairState && userPairState.user; // this is an User object.  see:  https://thegraph.com/explorer/subgraph/uniswap/uniswap-v2?selected=playground
    //console.log(JSON.stringify(userPairState)+"_"+JSON.stringify(stateQuery))
    let echartsOption
    let isReady = !userLoading && stateQuery
    //开始生成图表
    let msg = '正在加载....'
    if (isReady) {
        if (user !== null) {
            if (user.liquidityPositions.length > 0) {
                let addressName = address2name[queryParam.pairAddress]
                let tokenObjA = config.tokens[addressName.split('-')[0]]
                let tokenObjB = config.tokens[addressName.split('-')[1]]
                let tokenA = new Token(config.chainId, tokenObjA.address, tokenObjA.decimals, tokenObjA.symbol)
                let tokenB = new Token(config.chainId, tokenObjB.address, tokenObjB.decimals, tokenObjB.symbol)

                //推算token0,token1
                let tokenArr = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
                echartsOption = getEchartsOption(user, stateQuery.stateArr, tokenArr)
                //console.log(JSON.stringify(echartsOption))
            } else {
                isReady = false
                msg = '用户没有投入过这个交易对，相关数据不存在。'
            }
        } else {
            isReady = false
            msg = '该用户没有进行过任何活动，相关数据不存在。'
        }
    }
    //console.log(parseDate(queryParam.beginDate,format,'utc').getTime())

    //end 查询用户的出入金情况

    return <div>
        钱包地址:
        <input type="text" ref={userAddress} defaultValue={queryParam.userAddress}/>
        <br/>
        交易对:
        <select ref={pairAddress} defaultValue={queryParam.pairAddress}>
            {
                pairObjArr.map((value, index) => {
                    return <option key={"option_" + index} value={value.address}>{value.name}</option>
                })
            }
        </select>
        开始日期:
        <select ref={beginDate} defaultValue={parseDate(queryParam.beginDate, format, 'utc').getTime()}>
            {dateArr.map((date, index,) => {
                return <option key={"option_" + index} value={date.getTime()}>
                    {formatDate(date, 'yyyy-MM-dd', 'utc')}
                </option>
            })}
        </select>
        <br/>
        <span style={{color: 'blue', marginLeft: 30}}>当前时间(UTC):{formatDate(new Date(), format, 'utc')}</span>
        &nbsp;&nbsp;&nbsp;
        <button onClick={handleQuery}>查询</button>

        {!isReady ?
            <div>{msg}</div>
            :
            <ReactEcharts
                option={echartsOption}
                notMerge={true}
                lazyUpdate={false}
                //theme={"theme_name"}
                //onChartReady={this.onChartReadyCallback}
                //onEvents={EventsDict}
                style={{height: '400px', width: '1500px'}}
                //opts={}
            />

        }

    </div>

}

/**
 * 生成echarts 的option
 * @param subgraphUser  thegraph返回的user对象。参见 https://thegraph.com/explorer/subgraph/uniswap/uniswap-v2?selected=playground
 * @param stateArr
 * @param tokenArr 存储两个token, 按大小顺序排好了的 token0, token1
 * @return {{yAxis: {type: string}, xAxis: {type: string}, legend: {data: *}, grid: {left: string, bottom: string, right: string, containLabel: boolean}, series: *, tooltip: {trigger: string}, toolbox: {feature: {saveAsImage: {}}}, title: {text: string}}}
 */
function getEchartsOption(subgraphUser, stateArr, tokenArr) {
    if (tokenArr.length >= 1000) {
        alert("注意：返回的数据超过了1000条。应该调整查询条件。")
    }
    let series_dataArr = []//只要一个系列，所以不需要legend . 每个系列数据类型：{type:"line", data:[[xValue,yValue],[xValue,yValue]]}
    let legend_dataArr = []//样例说明

    /* SnapshotArr 按时间倒序排列的。数据格式:
    {
              "liquidityTokenBalance": "310.730130116295128061", #当前用户的流动性代币的数量
              "liquidityTokenTotalSupply": "16051.357484905455861943", #资金池流动性代币的总量
              "reserve0": "114420.049371327751324915",
              "reserve1": "2360.523159852754758022",
              "reserveUSD": "1082448.581713779335479667491722625",
              "token0PriceUSD": "4.730152572303589466585348665397484",
              "token1PriceUSD": "229.2814999919976543196611744047534",
              "timestamp": 1598020737
            }
     */
    //console.log(JSON.stringify(subgraphUser))
    let snapshotArr = subgraphUser.liquidityPositions[0].historicalSnapshots
    let series = []//一个系列的数据

    let yAxisName = '?'
    let fix, change
    for (let i = snapshotArr.length - 1; i >= 0; i--) {

        let snapshot = snapshotArr[i]
        let snapshotDateStr = formatDate(new Date(snapshot.timestamp * 1000), format, 'utc')
        let nextSnapshotDateStr = i > 0 ? formatDate(new Date(snapshotArr[i - 1].timestamp * 1000), format, 'utc') : null
        //console.log((snapshot.liquidityTokenBalance / snapshot.liquidityTokenTotalSupply) * snapshot.reserve0)
        let myInitReserveArr = [
            (snapshot.liquidityTokenBalance / snapshot.liquidityTokenTotalSupply) * snapshot.reserve0,
            (snapshot.liquidityTokenBalance / snapshot.liquidityTokenTotalSupply) * snapshot.reserve1
        ]
        //console.log(JSON.stringify(snapshot))
        //console.log(snapshot.liquidityTokenBalance+"_"+snapshot.liquidityTokenTotalSupply)
        //计算盈亏时，哪个币是固定的，哪个是浮动的。把固定币的变化量，折算成浮动的
        fix = myInitReserveArr[0] < myInitReserveArr[1] ? 0 : 1
        change = myInitReserveArr[0] < myInitReserveArr[1] ? 1 : 0
        yAxisName = tokenArr[change].symbol

        //针对每次快照，都重新扫描stateArr
        for (let pairState of stateArr) {
            /* pairState格式：
            {date_time:"YYYY-MM-dd HH:mm:ss",
            totalsupply:"9765431966117440",
            reserve0:"9765431966117440",
            reserve1::"9765431966117440"
            }
            * */
            //如果当前pair状态>=快照时间，才需要处理
            if (pairState.date_time >= snapshotDateStr) {
                //如果当前pair状态没有进入下一个快照(或者下一个快照不存在),才需要处理
                if (!nextSnapshotDateStr || pairState.date_time < nextSnapshotDateStr) {
                    if (snapshot.liquidityTokenBalance === '0') {//如果没有资金，就不用计算
                        series.push([pairState.date_time, 0])
                    } else {
                        let totalsupply = movePointLeft(pairState.totalsupply, 18)
                        let pairReserveArr = [
                            parseFloat(movePointLeft(pairState.reserve0, tokenArr[0].decimals)),
                            parseFloat(movePointLeft(pairState.reserve1, tokenArr[1].decimals))]
                        let liquidityShare = snapshot.liquidityTokenBalance / totalsupply
                        let myReserveArr = [
                            liquidityShare * pairReserveArr[0],
                            liquidityShare * pairReserveArr[1]
                        ]
                        let earn = ((myReserveArr[fix] - myInitReserveArr[fix]) * (myReserveArr[change] / myReserveArr[fix])) +
                            myReserveArr[change] - myInitReserveArr[change]
                        earn = earn.toFixed(3)
                        //console.log(JSON.stringify(myReserveArr) + '\n' + JSON.stringify(myInitReserveArr))
                        series.push([pairState.date_time, earn])
                    }
                } else {
                    break //break inner for
                }
            }

        }//end inner for

    }//end outer for
    //插入一个系列
    //console.log(JSON.stringify(series))
    series_dataArr.push({type: "line", data: series})
    legend_dataArr.push([tokenArr[change].symbol + '-' + tokenArr[fix].symbol])

    // 指定图表的配置项和数据
    var option = {
        title: {
            text: '收入累积走势图'
        },
        tooltip: {
            trigger: 'axis',
            formatter: '{c}'

        },
        legend: {
            data: legend_dataArr
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        toolbox: {
            feature: {
                saveAsImage: {}
            }
        },
        xAxis: {
            type: 'time',
            //boundaryGap:['20%','20%'] , //

        },
        yAxis: {
            type: 'value',
            name: yAxisName
        },
        series: series_dataArr,

    };


    return option;
}//end function

