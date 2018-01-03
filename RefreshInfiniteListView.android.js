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
    Animated
} from 'react-native';

/* list status change graph
 *
 *STATUS_NONE->[STATUS_REFRESH_IDLE, STATUS_INFINITE_IDLE, STATUS_INFINITE_LOADED_ALL]
 *STATUS_REFRESH_IDLE->[STATUS_NONE, STATUS_WILL_REFRESH]
 *STATUS_WILL_REFRESH->[STATUS_REFRESH_IDLE, STATUS_REFRESHING]
 *STATUS_REFRESHING->[STATUS_NONE]
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
        this.state = this.loadInitialState();
    }

    componentWillMount() {
        if(this.props.isPullRefresh){
            this._panResponder = PanResponder.create({
                onStartShouldSetPanResponder: () => !this.isScrollEnable,
                onMoveShouldSetPanResponder: () => !this.isScrollEnable,
                onPanResponderMove: this.handlePanResponderMove,
                onPanResponderRelease: this.handlePanResponderEnd,
                onPanResponderTerminate: this.handlePanResponderEnd
            });
        }
        else {
            this._panResponder={};
        }
    }

    loadInitialState() {
        this.scrollFromTop = true;
        this.contentHeight = 0;
        this.height = 0;
        this.scrollY = 0;
        this.isCanScroll = false;
        this.maxScrollY = 0;
        this.status=STATUS_NONE,
            this.defaultXY = {x: 0, y: this.props.isPullRefresh?this.props.headerRefresherHeight * -1:0};
        this.isScrollEnable=false
        return {
            height: 0,
            widthd:0,
            translateY: new Animated.ValueXY(this.defaultXY),

        };
    }

    changeHeaderRefresherState(status){
        this.status=status;
        this.props.onHeaderRefresherStateChange(status);
    }

    renderHeader() {
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
    }

    handlePanResponderMove=(e, gestureState)=> {
        const offset = gestureState.dy;
        let lastStatus = this.status;
        console.log('handlePanResponderMove',lastStatus,offset);
        if (this.scrollY === 0) {
            if (offset > 0 && this.status === STATUS_NONE) {
                lastStatus = STATUS_REFRESH_IDLE;
                this.changeHeaderRefresherState(STATUS_REFRESH_IDLE);
            } else if (offset < 0) {
                this.scrollFromTop = true;
            }
        }
        if (lastStatus === STATUS_NONE) {
            if (this.scrollFromTop && offset < 0) {
                this.refs.scrollView.scrollTo({y: -offset, animated: true});
            } else if (!this.scrollFromTop && offset > 0) {
                this.refs.scrollView.scrollTo({y: this.maxScrollY - offset, animated: true});
            }
        }

        if (this.status === STATUS_REFRESH_IDLE || this.status === STATUS_WILL_REFRESH) {
            this.changeHeaderRefresherPosition(offset);
            if (offset < this.props.pullDistance) {
                this.changeHeaderRefresherState(STATUS_REFRESH_IDLE);

            } else if (offset > this.props.pullDistance) {
                this.changeHeaderRefresherState(STATUS_WILL_REFRESH);
            }
        }
    }

    changeHeaderRefresherPosition(offset){
        this.state.translateY.setValue({x: this.defaultXY.x, y: offset / 2});

    }
    resetHeaderRefresherPosition(){
        this.state.translateY.setValue(this.defaultXY);
    }

    beginRefresh(){
        if(this.props.isPullRefresh){
            this.refs.scrollView.scrollTo({y:0});
            Animated.timing(this.state.translateY, {
                toValue: {x:this.defaultXY.x,y:0},
                duration:this.props.duration
            }).start(()=>{
                this.changeHeaderRefresherState(STATUS_REFRESHING);
                this.finishRefresh();
            });
        }
        else {
            this.changeHeaderRefresherState(STATUS_REFRESHING);
            this.finishRefresh();
        }

    }


    finishRefresh=()=>{
        const f=()=>{
            this.props.onHeaderRefresherStateChange(STATUS_FINISH_REFRESH);
            if(this.props.isPullRefresh){
                Animated.sequence([
                        Animated.delay(this.props.showResultTime),
                        Animated.timing(this.state.translateY, {
                            toValue: this.defaultXY,
                            duration:this.props.duration
                        }),
                    ]
                ).start(()=>{
                    this.changeHeaderRefresherState(STATUS_NONE);
                    this.setScrollEnable(false);
                });
            }
            else {
                this.changeHeaderRefresherState(STATUS_NONE);
                this.setScrollEnable(false);

            }
        }
        if(this.props.onRefresh){
            this.props.onRefresh(f);
        }
        else {
            f();
        }
    }

    handlePanResponderEnd=()=> {
        const status = this.status;
        if (status === STATUS_REFRESH_IDLE) {
            this.resetHeaderRefresherPosition();
            this.changeHeaderRefresherState(STATUS_NONE);
        } else if (status === STATUS_WILL_REFRESH) {
            this.state.translateY.setValue({x: this.defaultXY.x, y: 0});
            this.changeHeaderRefresherState(STATUS_REFRESHING);
            this.finishRefresh();
        }
        if (this.scrollY > 0) {
            this.setScrollEnable(true);
        }
    }

    isScrolledToTop=()=> {
        if ((this.scrollY === 0) && this.isScrollEnable) {
            this.setScrollEnable(false);
        }
    }

    setScrollEnable(bool){
        this.isScrollEnable=bool;
        this.refs.scrollView.setNativeProps({scrollEnabled:bool});
    }

    handleScroll=(event)=> {
        this.scrollY = Math.floor(event.nativeEvent.contentOffset.y);
    }
    onLayout=(e)=> {
        console.log('onLayout..',e.nativeEvent.layout);
        if (this.state.width != e.nativeEvent.layout.width || this.state.height != e.nativeEvent.layout.height) {
            this.refs.scrollView.setNativeProps({style: {width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height}});
            this.state.width = e.nativeEvent.layout.width;
            this.state.height = e.nativeEvent.layout.height;
        }
    }

    render() {
        return (
            <View  style={[styles.container]} onLayout={this.onLayout} {...this._panResponder.panHandlers} >
                <Animated.View  style={[this.state.translateY.getLayout()]}>
                    {this.props.isPullRefresh&&this.renderHeader()}
                    <ListView
                        {...this.props}
                        style={[{width: this.state.width, height: this.state.height},this.props.listViewStyle]}
                        dataSource={ds.cloneWithRows(this.props.dataSource)}
                        ref='scrollView'
                        onScroll={this.handleScroll}
                        onTouchEnd={ this.isScrolledToTop}
                        onScrollEndDrag={this.isScrolledToTop}
                        onMomentumScrollEnd={ this.isScrolledToTop}
                        onResponderRelease={this.isScrolledToTop}
                    />
                </Animated.View>
            </View>
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
    listViewStyle:View.propTypes.style,
    isPullRefresh:PropTypes.bool,
}

RIListView.defaultProps = {
    headerRefresherHeight:DEFAULT_HF_HEIGHT,
    pullDistance: DEFAULT_PULL_DISTANCE,
    showResultTime:REFRESH_SHOW_TIME,
    duration:DURATION,
    onHeaderRefresherStateChange:()=>{},
    isPullRefresh:true
}

const styles = StyleSheet.create({
    container:{
        flex: 1,
        flexDirection: 'column',
    }
});
