/* eslint-disable react/display-name,react/no-multi-comp,complexity,max-statements */
import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {
    Image,
    View,
    Text,
    StyleSheet,
    ListView,
    Dimensions,
    ActivityIndicator,
    PanResponder,
    Animated,
    InteractionManager,
    ViewPropTypes
} from 'react-native';

/* list status change graph
 *
 *STATUS_NONE->[STATUS_REFRESH_IDLE, STATUS_INFINITE_IDLE, STATUS_INFINITE_LOADED_ALL]
 *STATUS_REFRESH_IDLE->[STATUS_NONE, STATUS_WILL_REFRESH]
 *STATUS_WILL_REFRESH->[STATUS_REFRESH_IDLE, STATUS_REFRESHING]
 *STATUS_REFRESHING->[STATUS_NONE]
 *STATUS_INFINITE_IDLE->[STATUS_NONE, STATUS_WILL_INFINITE]
 *STATUS_WILL_INFINITE->[STATUS_INFINITE_IDLE, STATUS_INFINITING]
 *STATUS_INFINITING->[STATUS_NONE]
 *STATUS_INFINITE_LOADED_ALL->[STATUS_NONE]
 *
 */
export const STATUS_NONE = 0;
export const STATUS_REFRESH_IDLE = 1;
export const STATUS_WILL_REFRESH = 2;
export const STATUS_REFRESHING = 3;
export const STATUS_FINISH_REFRESH=8;


const DEFAULT_PULL_DISTANCE = 60;
const DEFAULT_HF_HEIGHT = 50;

const DURATION=500
const REFRESH_SHOW_TIME=1200

const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

export default class RIListView extends PureComponent {

    constructor(props) {
        super(props);
        this.status=STATUS_NONE;
        this.lastBeginDragY=this.props.headerRefresherHeight;
        this.isAutoRefresh=false;
        this.isShowingResult=false;
        this.isInitialed=false;
    }

    componentDidMount() {
        InteractionManager.runAfterInteractions(() => {
                this.resetHeaderRefresherPosition(false);
        })
    }

    componentWillUnmount(){
        this.timer&&clearTimeout(this.timer);
    }

    resetHeaderRefresherPosition(animated){
        if(this.props.isPullRefresh===true){
            this.listviewRef.scrollTo({y:this.props.headerRefresherHeight,animated:animated});
        }

    }

    setHeaderRefresherPositionToRefresh(animated){
        this.listviewRef.scrollTo({y:0,animated:animated});
    }

    changeHeaderRefresherState(status){
        if(this.status!==status){
            this.status=status;
            if(this.props.isPullRefresh){
                this.props.onHeaderRefresherStateChange(status);
            }
            if(this.status===STATUS_REFRESHING){
                this.setHeaderRefresherPositionToRefresh(true);
                this.handleRefresh();
            }
            else if(this.isAutoRefresh&&this.status===STATUS_WILL_REFRESH){
                    this.isAutoRefresh=false;
                    this.changeHeaderRefresherState(STATUS_REFRESHING);
            }
            else if(this.status===STATUS_FINISH_REFRESH&&this.props.isPullRefresh){
                this.timer&&clearTimeout(this.timer);
                this.isShowingResult=true;
                this.timer=setTimeout(()=>{
                    this.isAutoRefresh=false;
                    this.isShowingResult=false;
                    this.resetHeaderRefresherPosition(true);
                },this.props.showResultTime);
            }
        }
    }

    renderHeader=()=>{
        if(this.props.headerRefresher){
            return this.props.headerRefresher;
        }
        else {

            return (
                <View  style={[{backgroundColor:'blue',height:this.props.headerRefresherHeight}]}>
                    <Text>{'下拉刷新'}</Text>
                </View>
            )
        }
    };

    onScrollBeginDrag=(event)=> {

         this.lastBeginDragY = event.nativeEvent.contentOffset.y;
    };

    onScrollEndDrag=()=> {

        const status = this.status;
        if (status === STATUS_REFRESH_IDLE) {
            this.changeHeaderRefresherState(STATUS_NONE);
        } else if (status === STATUS_WILL_REFRESH) {
            this.changeHeaderRefresherState(STATUS_REFRESHING);
        }
    };

    handleScroll=(event)=> {

        const offset=this.props.headerRefresherHeight-this.lastBeginDragY;
        if(offset>=0&&offset<2&&this.status!==STATUS_REFRESHING&&this.isShowingResult!==true){
            const nativeEvent = event.nativeEvent;
            // console.log('handleScroll',nativeEvent.contentOffset.y,this.status);
            const status = this.status;
                const y = nativeEvent.contentInset.top + nativeEvent.contentOffset.y;
                if (status !== STATUS_WILL_REFRESH && y <= -this.props.pullDistance) {
                    this.changeHeaderRefresherState(STATUS_WILL_REFRESH);
                } else if (status === STATUS_WILL_REFRESH && y > -this.props.pullDistance) {
                    this.changeHeaderRefresherState(STATUS_REFRESH_IDLE);
                }
                else if(status===STATUS_FINISH_REFRESH&&nativeEvent.contentOffset.y===this.props.headerRefresherHeight){
                    this.changeHeaderRefresherState(STATUS_REFRESH_IDLE);
                }
        }

    };



    beginRefresh(){

        if(this.props.isPullRefresh){
                this.isAutoRefresh=true;
                this.lastBeginDragY=this.props.headerRefresherHeight;
                this.setHeaderRefresherPositionToRefresh(true);
        }
        else {
            this.changeHeaderRefresherState(STATUS_REFRESHING);
            this.handleRefresh();
        }

    }

    calculateContentInset = () => {
        if (this.props.isPullRefresh === true) {
            return {top: -1 * this.props.headerRefresherHeight, bottom: 0, left: 0, right: 0};
        } else {
            return {top: 0, bottom: 0, left: 0, right: 0};
        }
    };

    handleRefresh=()=>{
        const f=()=>{

            this.changeHeaderRefresherState(STATUS_FINISH_REFRESH);
        }
        if(this.props.onRefresh){
            this.props.onRefresh(f);
        }
        else {
            f();
        }
    }




    render() {
        return (
            <ListView
                {...this.props}
                ref={(c)=>{
                        this.listviewRef=c;
                }}

                automaticallyAdjustContentInsets={false}
                contentInset={this.calculateContentInset()}
                dataSource={ds.cloneWithRows(this.props.dataSource)}
                renderHeader={this.props.isPullRefresh===true?this.renderHeader:null}
                onScroll={this.props.isPullRefresh === true ? this.handleScroll : null}
                onScrollEndDrag={this.props.isPullRefresh === true ? this.onScrollEndDrag : null}
                onScrollBeginDrag={this.props.isPullRefresh === true ? this.onScrollBeginDrag : null}
            />
        );
    }
}


RIListView.propTypes= {
    headerRefresherHeight:PropTypes.number,
    showResultTime:PropTypes.number,
    duration:PropTypes.number,
    pullDistance: PropTypes.number,
    onRefresh: PropTypes.func,
    onHeaderRefresherStateChange:PropTypes.func,
    headerRefresher:PropTypes.element,
    listViewStyle:ViewPropTypes.style,
    isPullRefresh:PropTypes.bool,
}

RIListView.defaultProps = {
    headerRefresherHeight:DEFAULT_HF_HEIGHT,
    pullDistance: DEFAULT_PULL_DISTANCE,
    showResultTime:REFRESH_SHOW_TIME,
    duration:DURATION,
    onHeaderRefresherStateChange:()=>{},
    isPullRefresh:true,

}

const styles = StyleSheet.create({
    container:{
        flex: 1,
        flexDirection: 'column',
    }
});
