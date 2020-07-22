import React, {useEffect, useState} from 'react';
import './App.css';
import {ApolloClient} from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {HttpLink} from 'apollo-link-http'
import {useQuery} from '@apollo/react-hooks'
import gql from 'graphql-tag'


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
const feeRate=0.003 /* 平台收用户的手续费是0.003,但是分给做市商的只有0.0025 */
const myIncomeRate=25/30
const pairObjArr=[
    {name:'snx-eth',address:'0x43ae24960e5534731fc831386c07755a2dc33d47',follow:true,myReserveUSD:0},
    {name:'eth-dmg',address:'0x8175362afbeee32afb22d05adc0bbd08de32f5ae',follow:false,myReserveUSD:0},
    {name:'comp-eth',address:'0xcffdded873554f362ac02f8fb1f02e5ada10516f',follow:false,myReserveUSD:0},
    {name:'usdc-eth',address:'0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',follow:true,myReserveUSD:20417},
    {name:'eth-ampl',address:'0xc5be99a02c6857f9eac67bbce58df5572498f40c',follow:false,myReserveUSD:0},
    {name:'bat-eth',address:'0xb6909b960dbbe7392d405429eb2b3649752b4838',follow:false,myReserveUSD:0},
    {name:'link-eth',address:'0xa2107fa5b38d9bbd2c461d6edf11b11a50f6b974',follow:true,myReserveUSD:21162},
    {name:'eth-knc',address:'0xf49c43ae0faf37217bdcb00df478cf793edd6687',follow:true,myReserveUSD:20566},
    {name:'dai-eth',address:'0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',follow:false,myReserveUSD:0},
    {name:'usdc-usdt',address:'0x3041cbd36888becc7bbcbc0045e3b1f144466f5f',follow:false,myReserveUSD:0},
    {name:'mkr-eth',address:'0xc2adda861f89bbb333c90c492cb837741916a225',follow:false,myReserveUSD:0},
    {name:'lend-eth',address:'0xab3f9bf1d81ddb224a2014e98b238638824bcf20',follow:false,myReserveUSD:0},
    {name:'eth-zrx',address:'0xc6f348dd3b91a56d117ec0071c1e9b83c0996de4',follow:true,myReserveUSD:0},
    {name:'wbtc-eth',address:'0xbb2b8038a1640196fbe3e38816f3e67cba72d940',follow:false,myReserveUSD:0},
    {name:'eth-renBtc',address:'0x81fbef4704776cc5bba0a5df3a90056d2c6900b3',follow:false,myReserveUSD:0},
]
//生成映射，便于查询
const address2name={},name2address={},address2Obj={}
pairObjArr.forEach((obj)=>{
    address2name[obj.address]=obj.name
    name2address[obj.name]=obj.address
    address2Obj[obj.address]=obj
})

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
                pairDayDatas(first:10,orderBy:date, orderDirection:desc,
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
                pairObjArr.map((value, index)=>{
                    return <option key={"option_"+index} value={value.address} >{value.name}</option>
                })
            }
        </select>
        <span style={{color:'blue',marginLeft:30}}>每天在UTC时间0点(北京时间08:00:00)结束当天的统计，开启新的一天</span>

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
                    </tr>].concat(!pairDayDatas ?[] :
                        pairDayDatas.map((value, index) => {
                            let theDate = new Date(parseInt(value.date) * 1000)
                            return <tr key={"tr_" + index}>
                                <td>{(theDate.getMonth() + 1) + "." + theDate.getDate()}</td>
                                <td>{value.dailyTxns}</td>
                                <td>{parseFloat(value.reserveUSD).toFixed(2)}</td>
                                <td>{parseFloat(value.dailyVolumeUSD).toFixed(2)}</td>
                                <td>{(parseFloat(value.dailyVolumeUSD) * feeRate).toFixed(2)}</td>
                                <td>{(myIncomeRate*365*100*parseFloat(value.dailyVolumeUSD) * feeRate/parseFloat(value.reserveUSD)).toFixed(2)}</td>
                                <td>{address2Obj[value.pairAddress].myReserveUSD}</td>
                                <td>{(parseFloat(value.dailyVolumeUSD) * (myIncomeRate*feeRate)*address2Obj[value.pairAddress].myReserveUSD/parseFloat(value.reserveUSD)).toFixed(2)}</td>
                            </tr>
                        })
                    )
            }
            </tbody>
        </table>
    </div>

}

const OneDayMorePair=()=>{
    //生成日期数组
    const dateArr=[]
    for(let i=0;i<60;i++){
        let today=new Date()
        today.setUTCDate(today.getUTCDate()-i)
        today.setUTCHours(0,0,0);
        dateArr.push(today)
    }

    const defaultDayInSeconds=parseInt((dateArr[0].getTime()/1000).toString())

    const [state, setState] = useState({day: defaultDayInSeconds});

    const handleSelectChange = (e) => {
        setState({
            day: parseInt(e.target.value)
        })

    }
    const followStyle={background:"yellow"}
    const ONE_DAY_MORE_PAIR_QUERY = gql`
            query oneDayMorePair($date: Int!) {
                pairDayDatas(orderBy:pairAddress,
                where:{date:$date,
                  pairAddress_in: [
                    ${pairObjArr.map((obj)=>{return `"${obj.address}"`})}
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


    let myTotalReserve=0
    let myTotalEarn=0

    return <div>
        日期:
        <select
            defaultValue={defaultDayInSeconds} onChange={handleSelectChange}>
            {dateArr.map((date, index, ) => {
                return <option key={"option_"+index} value={parseInt((date.getTime()/1000).toString())}>
                    {date.getUTCFullYear()+"-"+(date.getUTCMonth()+1)+"-"+date.getUTCDate()}
                </option>
        })}
        </select>
        <span style={{color:'blue',marginLeft:30}}>每天在UTC时间0点(北京时间08:00:00)结束当天的统计，开启新的一天</span>
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
                    </tr>].concat(!pairDataArr ?[] :
                        pairDataArr.map((value, index, ) => {
                            let thisReverse=address2Obj[value.pairAddress].myReserveUSD
                            let thisEarn=(parseFloat(value.dailyVolumeUSD) * (myIncomeRate*feeRate)*address2Obj[value.pairAddress].myReserveUSD/parseFloat(value.reserveUSD))
                            myTotalReserve+=thisReverse
                            myTotalEarn+=thisEarn

                            return <tr key={"tr_" + index} style={address2Obj[value.pairAddress].follow?followStyle:null} >
                                <td>{address2name[value.pairAddress]}</td>
                                <td>{value.pairAddress}</td>
                                <td>{value.dailyTxns}</td>
                                <td>{parseFloat(value.reserveUSD).toFixed(2)}</td>
                                <td>{parseFloat(value.dailyVolumeUSD).toFixed(2)}</td>
                                <td>{(parseFloat(value.dailyVolumeUSD) * feeRate).toFixed(2)}</td>
                                <td>{(myIncomeRate*365*100*parseFloat(value.dailyVolumeUSD) * feeRate/parseFloat(value.reserveUSD)).toFixed(2)}</td>
                                <td>{thisReverse}</td>
                                <td>{thisEarn.toFixed(2)}</td>
                            </tr>
                        })
                    ).concat(
                        <tr key={"tr_foot"} style={{color:'red'}}>
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
