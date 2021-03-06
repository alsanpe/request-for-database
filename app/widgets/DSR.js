import React, {Component} from 'react';
import _ from 'lodash';
import * as BS from 'react-bootstrap';
import DSRButton from "../components/DsrButton";
import FadeOutNotice from "../components/FadeOutNotice";
import {LoadingInline} from "../components/Loading";
import ErrorPanel from "../components/ErrorPanel";
import {dataTableDict, dataTableDict2} from "../config/widgetDict";

import PropTypes from 'prop-types';
import BaseWidget from './Base'
import Table from "../components/DynamicTable";

class DSRWidget extends BaseWidget{

    constructor(props){
        super(props);
        this.state = {
            loaded: false,
            contexts: '',
            data_types: '',
            noticeMessage: '',
            error: false
        };

        this.genRowArray = this.genRowArray.bind(this);
    }

    async loadData(){
        try {
            let contexts = await this.api.getContexts(),
                data_types = await this.api.getDataTypes(this.props.dataTypeIds);

            _.map(data_types, (data_type)=>{
                data_type["consentNames"] = [];
                data_type["basis"] = [];
            });

            contexts.forEach((context) => {
                let contextName = this.dict.getName(context.name).toLowerCase(), basis = "Consent";

                if (_.includes(contextName, 'banking'))
                    basis = 'Government Law';
                else if (_.includes(contextName, 'loan'))
                    basis = 'Contract';
                context.consentDefinitions.map((consent) => {
                    name = this.dict.getName(consent.name);

                    if (data_types[consent.dataTypeId]) { // If the data type doesn't exist -> bad data on db
                        data_types[consent.dataTypeId].consentNames.push(name);
                        data_types[consent.dataTypeId].basis.push(basis);
                    }
                })
            });

            this.setState({contexts, data_types, loaded: true});
        }
        catch(error){
            this.setState({error: error.toString()})
        }
    }

    async loadRights(){
        try {
            let {dataTypeIds, contextTags} = this.props,
                rights = await this.api.getRights(dataTypeIds, contextTags)

            this.setState({rights, loaded: true});
        }
        catch(e){
            this.setState({error: error.toString()})
        }
    }

    onProcessed(eventProcessed){
        let {onProcessed} = this.props;

        let noticeMessage, {code, dataType, action} = eventProcessed;
        if(code === 409) {
            noticeMessage = `Unable to register your request. There is already a data ${action} \
            request pending for ${dataType}`;
            this.setState({noticeMessage: noticeMessage, dsrError: true});
        }
        else {
            noticeMessage = `Thank you, your ${action} request for ${dataType} is currently being reviewed`;
            this.setState({noticeMessage: noticeMessage, dsrError: false});
            if (_.isFunction(onProcessed))
                onProcessed();
        }
    }

    componentDidMount() {
        this.props.showAll ? this.loadData() : this.loadRights();
    }

    genRowArray(data_type){
        try {
            return ([
                <span>{this.dict.getName(data_type.name)}</span>,
                <span style={{wordBreak: "break-all"}}>{(data_type.consentNames.length) ? data_type.consentNames.join(", ") : "None"}</span>,
                <span>{(data_type.basis.length) ? data_type.basis.join(", ") : "None"}</span>,
                <DSRButton dict={this.dict} truConfig={this.props.truConfig} dataType={data_type}
                           onProcessed={this.onProcessed.bind(this)}/>
            ])
        }catch(e){}//Sometimes the data sent by right api is corrupted
    }

    genRightRowArray(entry, i){
        try {
            let where = entry.whereItsUsed.map((val, id)=>{
                return <p key={id}>
                    {this.dict.getName(val.contextName)}: {this.dict.getName(val.consentDefinition.name)}
                    {(id < entry.whereItsUsed.length - 1) && <br/>}
                </p>
            }) 

            return ([
                <span id={"my-data-personal-info-" + i}>{this.dict.getName(entry.right.dataType[0].name)}</span>,
                <span id={"my-data-where-its-used-" + i} style={{wordBreak: "break-all"}}>
                    {where}
                </span>,
                <DSRButton id={"my-data-action-button-" + i} dict={this.dict} truConfig={this.props.truConfig} dataType={entry.right.dataType[0]}
                           onProcessed={this.onProcessed.bind(this)}/>
            ])
        }catch(e){}//Sometimes the data sent by right api is corrupted
    }


    render() {
        let display;
        let {error, loaded, data_types, dsrError, noticeMessage, rights} = this.state, {table, showAll} = this.props;

        if(error)
            display = <ErrorPanel/>;
        else if(!loaded)
            display = <LoadingInline/>;
        else{
            let headers;
            let body;

            if (showAll) {
                body = _.map(data_types, this.genRowArray);
                headers = this.dict.getName(dataTableDict);
            }else{
                let processed = {};
                _.forEach(rights, (contextRights, contextId) => {
                    return _.forEach(contextRights, (right) => {
                        let {dataTypeId} = right.consentDefinition;

                        if(!processed[dataTypeId]) {
                            processed[dataTypeId] = {
                                right,
                                whereItsUsed: []
                            };
                        }
                        processed[dataTypeId].whereItsUsed.push(right);
                    })
                });
                let i = 0
                body = _.map(processed, (dataType) => {
                    i++
                    return this.genRightRowArray(dataType, i)
                })
                headers = this.dict.getName(dataTableDict2);
            }

            display = <Table header={headers} data={body} {...table}/>
        }



        return <BS.Panel style={{width: '100%', minWidth: '530px'}}>
            <FadeOutNotice show={!!noticeMessage} text={noticeMessage}
                           bsStyle={dsrError ? 'danger':'success'}
                           after={()=>{this.setState({noticeMessage: ''})}}/>
            {display}
        </BS.Panel>
    }
}

DSRWidget.propTypes = {
    ...BaseWidget.propTypes,
    table: PropTypes.object,
    dataTypeIds: PropTypes.arrayOf(PropTypes.string),
    showAll: PropTypes.bool,
    contextTags: PropTypes.arrayOf(PropTypes.string)
};

DSRWidget.defaultProps = {
    table: Table.widgetTableProps,
    dataTypeIds: null,
    showAll: false,
    contextTags: null
};

export default DSRWidget;