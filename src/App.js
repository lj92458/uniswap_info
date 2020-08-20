import React, {useEffect, useState} from 'react';
import './App.css';
import {ApolloClient} from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {HttpLink} from 'apollo-link-http'
import {useQuery} from '@apollo/react-hooks'
import gql from 'graphql-tag'
import {pairObjArr} from './properties.json'

export const client = new ApolloClient({
    link: new HttpLink({
        //uri: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
        uri: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswapv2",
    }),
    fetchOptions: {
        mode: 'no-cors'
    },
    cache: new InMemoryCache(),
})

const tableStyle = {textAlign: "right", borderCollapse: "collapse"}
const feeRate = 0.003 /* 平台收用户的手续费是0.003,但是分给做市商的只有0.0025 */
const myIncomeRate = 1 //25 / 30

//生成映射，便于查询
const address2name = {}, name2address = {}, address2Obj = {}
pairObjArr.forEach((obj) => {
    address2name[obj.address] = obj.name
    name2address[obj.name] = obj.address
    address2Obj[obj.address] = obj
})

//读取配置文件中指定日期对应的金额
const findReserveUSD = (date, pairObj) => {

    let before //ReserveObj
    for (let i = 0; i < pairObj.myReserveUSD.length; i++) {
        let strArr = pairObj.myReserveUSD[i].dateStr.split("-")
        let parsedDate = new Date(parseInt(strArr[0]), parseInt(strArr[1]) )
        parsedDate.setUTCDate(parseInt(strArr[2]))
        parsedDate.setUTCHours(0)

        if (date < parsedDate) {
            break
        } else {
            before = pairObj.myReserveUSD[i]
        }
    }//end for

    return before ? before.value : 0


}

const OnePairMoreDay = () => {
    const defaultPair = "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc"
    const [state, setState] = useState({pairAddress: defaultPair});

    const handleSelectChange = (e) => {
        setState({
            pairAddress: e.target.value
        })

    }


    const PAIR_DAY_QUERY = gql`
            query pairDay($pairAddress: Bytes!) {
                pairDayDatas(first:20,orderBy:date, orderDirection:desc,
                where:{pairAddress: $pairAddress}){
                    dailyTxns
                    date
                    pairAddress
                    reserveUSD
                    dailyVolumeUSD
          }
        }
        `

    const {loading: pairDayLoading, error: pairDayError, data: pairDayResult} = useQuery(PAIR_DAY_QUERY, {
        variables: {
            pairAddress: state.pairAddress
        }
    })
    const pairDayDatas = pairDayResult && pairDayResult.pairDayDatas; // this is an array

    return <div>
        交易对:
        <select
            defaultValue={defaultPair} onChange={handleSelectChange}>
            {
                pairObjArr.map((value, index) => {
                    return <option key={"option_" + index} value={value.address}>{value.name}</option>
                })
            }
        </select>
        <span style={{color: 'blue', marginLeft: 30}}>每天在UTC时间0点(北京时间08:00:00)结束当天的统计，开启新的一天</span>

        <table style={tableStyle}>
            <tbody>
            {
                pairDayLoading ?
                    <tr>
                        <td>Loading pair data...</td>
                    </tr>
                    :
                    [<tr key={"tr_head"}>
                        <td>日期</td>
                        <td>交易次数</td>
                        <td>资金量$</td>
                        <td>交易额$</td>
                        <td>手续费$</td>
                        <td>年化收益%</td>
                        <td>我的资金$</td>
                        <td>我的收益$</td>
                    </tr>].concat(!pairDayDatas ? [] :
                        pairDayDatas.map((value, index) => {
                            let theDate = new Date(parseInt(value.date) * 1000)
                            let myReserveUSD = findReserveUSD(theDate, address2Obj[value.pairAddress])
                            return <tr key={"tr_" + index}>
                                <td>{theDate.getUTCFullYear() + "-" + (theDate.getUTCMonth() + 1) + "-" + theDate.getUTCDate()}</td>
                                <td>{value.dailyTxns}</td>
                                <td>{parseFloat(value.reserveUSD).toFixed(2)}</td>
                                <td>{parseFloat(value.dailyVolumeUSD).toFixed(2)}</td>
                                <td>{(parseFloat(value.dailyVolumeUSD) * feeRate).toFixed(2)}</td>
                                <td>{(myIncomeRate * 365 * 100 * parseFloat(value.dailyVolumeUSD) * feeRate / parseFloat(value.reserveUSD)).toFixed(2)}</td>
                                <td>{myReserveUSD}</td>
                                <td>{(parseFloat(value.dailyVolumeUSD) * (myIncomeRate * feeRate) * myReserveUSD / parseFloat(value.reserveUSD)).toFixed(2)}</td>
                            </tr>
                        })
                    )
            }
            </tbody>
        </table>
    </div>

}

const OneDayMorePair = () => {
    //生成日期数组
    const dateArr = []
    for (let i = 0; i < 60; i++) {
        let today = new Date()
        today.setUTCDate(today.getUTCDate() - i)
        today.setUTCHours(0, 0, 0);
        dateArr.push(today)
    }

    const defaultDayInSeconds = parseInt((dateArr[0].getTime() / 1000).toString())

    const [state, setState] = useState({day: defaultDayInSeconds});

    const handleSelectChange = (e) => {
        setState({
            day: parseInt(e.target.value)
        })

    }
    const followStyle = {background: "yellow"}
    const ONE_DAY_MORE_PAIR_QUERY = gql`
            query oneDayMorePair($date: Int!) {
                pairDayDatas(orderBy:pairAddress,
                where:{date:$date,
                  pairAddress_in: [
                    ${pairObjArr.map((obj) => {
        return `"${obj.address}"`
    })}
                  ]},
                ){
                    dailyTxns
                    date
                    pairAddress
                    reserveUSD
                    dailyVolumeUSD
                 }
        }
        `

    const {loading: pairsLoading, error: pairsError, data: pairsResult} = useQuery(ONE_DAY_MORE_PAIR_QUERY, {
        variables: {
            date: state.day
        }
    })
    const pairDataArr = pairsResult && pairsResult.pairDayDatas; // this is an array


    let myTotalReserve = 0
    let myTotalEarn = 0
    let selectedDate = new Date(state.day * 1000)
    return <div>
        日期:
        <select
            defaultValue={defaultDayInSeconds} onChange={handleSelectChange}>
            {dateArr.map((date, index,) => {
                return <option key={"option_" + index} value={parseInt((date.getTime() / 1000).toString())}>
                    {date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCDate()}
                </option>
            })}
        </select>
        <span style={{color: 'blue', marginLeft: 30}}>每天在UTC时间0点(北京时间08:00:00)结束当天的统计，开启新的一天</span>
        <table style={tableStyle}>
            <tbody>
            {
                pairsLoading ?
                    <tr>
                        <td>Loading pair data...</td>
                    </tr>
                    :
                    [<tr key={"tr_head"}>
                        <td>交易对</td>
                        <td>地址</td>
                        <td>交易次数</td>
                        <td>资金量$</td>
                        <td>交易额$</td>
                        <td>手续费$</td>
                        <td>年化收益%</td>
                        <td>我的资金$</td>
                        <td>我的收益$</td>
                    </tr>].concat(!pairDataArr ? [] :
                        pairDataArr.map((value, index,) => {

                            let myReserve = findReserveUSD(selectedDate, address2Obj[value.pairAddress])
                            let myEarn = (parseFloat(value.dailyVolumeUSD) * (myIncomeRate * feeRate) * myReserve / parseFloat(value.reserveUSD))
                            myTotalReserve += myReserve
                            myTotalEarn += myEarn

                            return <tr key={"tr_" + index}
                                       style={address2Obj[value.pairAddress].follow ? followStyle : null}>
                                <td>{address2name[value.pairAddress]}</td>
                                <td>{value.pairAddress}</td>
                                <td>{value.dailyTxns}</td>
                                <td>{parseFloat(value.reserveUSD).toFixed(2)}</td>
                                <td>{parseFloat(value.dailyVolumeUSD).toFixed(2)}</td>
                                <td>{(parseFloat(value.dailyVolumeUSD) * feeRate).toFixed(2)}</td>
                                <td>{(myIncomeRate * 365 * 100 * parseFloat(value.dailyVolumeUSD) * feeRate / parseFloat(value.reserveUSD)).toFixed(2)}</td>
                                <td>{myReserve}</td>
                                <td>{myEarn.toFixed(2)}</td>
                            </tr>
                        })
                    ).concat(
                        <tr key={"tr_foot"} style={{color: 'red'}}>
                            <td>合计</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>{myTotalReserve}</td>
                            <td>{myTotalEarn.toFixed(0)}</td>
                        </tr>
                    )
            }
            </tbody>
        </table>
    </div>

}

function App() {

    return (
        <div>
            <style>
                {`table,table tr th, table tr td { border:1px solid #0094ff; }
                   
                `}
            </style>
            <OnePairMoreDay/>
            <OneDayMorePair/>
        </div>
    );
}

export default App;
