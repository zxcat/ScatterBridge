<template>
	<section class="signature">

		<section class="switcher">
			<figure class="type" @click="state = val" :class="{'active':state === val}" v-for="(val,key) in STATES">{{val}}</figure>
		</section>
		<section class="content" :class="{'no-flex details':state === STATES.Details}">


			<section class="app-details" v-if="state === STATES.Overview">
				<PopOutLogos :app="app" />

				<figure v-if="isOnlyTransfer"                 class="action">Transfer</figure>
				<figure v-if="!isOnlyTransfer && hasTransfer" class="action">Transfer & Actions</figure>
				<figure v-if="!hasTransfer"                   class="action">Actions</figure>
				<figure v-if="!isOnlyTransfer"                class="actions">
					{{messages.map(x => x.type).slice(0,2).join(', ')}}<span v-if="messages.length > 2">, +{{messages.length-2}} more</span>
				</figure>


				<figure class="app-name">via <b>{{app.name}}</b></figure>


				<section v-if="isOnlyTransfer && fiatAmount">
					<figure class="transfer-value">{{currency}}{{fiatAmount}}</figure>
					<figure class="transfer-value secondary">{{tokenTransfer.amount}} {{tokenTransfer.symbol}}</figure>
				</section>

				<section v-if="isOnlyTransfer && !fiatAmount">
					<figure class="transfer-value tokens">{{tokenTransfer.amount}} {{tokenTransfer.symbol}}</figure>
				</section>
			</section>

			<section v-if="state === STATES.Details">
				<section class="messages" :class="{'transfer':message.type === 'transfer'}" :ref="`message_${index}`" v-for="(message, index) in messages">
					<section>
						<label>By approving you will sign the following contract</label>
						<section class="contract-action">
							<figure>{{message.code}}</figure>
							<figure>{{message.type}}</figure>
						</section>

						<section class="properties" v-for="(value,key) in message.data">
							<input v-if="whitelisted && !isPreviouslyWhitelisted(message)" type="checkbox" @change="toggleWhitelistProp(getWhitelist(message), key)" />
							<section>
								<label>{{key}}</label>
								<figure class="value object" v-if="typeof value === 'object'">
									<!--<div :ref="hash(JSON.stringify(message)) + key + hash(value)" :v-html="formatJson(value, hash(JSON.stringify(message))+key)"></div>-->
									<pre>{{JSON.stringify(value, 0, 2)}}</pre>
								</figure>
								<figure class="value" v-else>{{value}}</figure>
							</section>
						</section>
					</section>
				</section>
			</section>
		</section>

		<section class="whitelist-this" v-if="!isArbitrarySignature">
			<section v-if="!whitelisted">
				<figure class="title">Do you want to <b>whitelist</b> this?</figure>
				<figure class="text">Whitelisting auto-signs identical contracts without having to re-approve.</figure>
			</section>

			<section v-if="whitelisted">
				<figure class="title">You have <b>enabled</b> whitelisting</figure>
				<figure class="text">Any checked field can change, unchecked field changes will require re-approval.</figure>
			</section>

			<section>
				<Switcher @click.native="whitelisted = !whitelisted" :state="whitelisted" />
			</section>
		</section>

		<section class="popout-buttons">
			<Button @click.native="closer" text="Deny" />
			<Button @click.native="accepted" primary="1" text="Sign" />
		</section>
	</section>
</template>

<script>
	import {IdentityRequiredFields} from "@walletpack/core/models/Identity";
	import {mapState} from "vuex";
	import Network from "@walletpack/core/models/Network";
	import SymbolBall from "../../components/reusable/SymbolBall";
	import PermissionService from "@walletpack/core/services/apps/PermissionService";
	import Account from "@walletpack/core/models/Account";
	import PriceService from "@walletpack/core/services/apis/PriceService";
	import Hasher from "@walletpack/core/util/Hasher";
	import JSONFormatter from 'json-formatter-js'
	import PopOutLogos from "../../components/popups/PopOutLogos";
	import Token from "@walletpack/core/models/Token";
	import {Blockchains} from "@walletpack/core/models/Blockchains";

	const STATES = {
		Overview:'Overview',
		Details:'Details'
	}

	export default {
		components: {PopOutLogos, SymbolBall},
		props:['popup', 'closer'],
		data(){return {
			STATES,
			state:STATES.Overview,


			whitelisted:false,
			whitelists:[],
			actionList:[],
		}},
		mounted(){
			if(this.isOnlyTransfer) PriceService.setPrices();
		},
		computed:{
			...mapState([
				'scatter',
			]),
			isArbitrarySignature(){ return !this.payload.hasOwnProperty('participants'); },
			payload(){ return this.popup.payload(); },
			app(){ return this.popup.data.props.appData; },
			network(){ return this.payload.network; },
			messages(){ return this.payload.messages; },
			fields(){ return IdentityRequiredFields.fromJson(this.payload.requiredFields || {}); },
			participantAccounts(){
				if(!this.payload.hasOwnProperty('participants')) return null;
				return this.payload.participants.map(x => {
					return Account.fromJson(x);
				})
			},
			currency(){
				return PriceService.fiatSymbol()
			},


			isOnlyTransfer(){
				return this.messages.length === 1 && this.messages[0].type === 'transfer';
			},
			hasTransfer(){
				return !!this.messages.find(x => x.type === 'transfer');
			},
			tokenTransfer(){
				if(!this.isOnlyTransfer) return;

				//TODO: Add for other blockchains too
				if(this.network.blockchain === Blockchains.EOSIO){
					const action = this.messages[0];
					const transfer = action.data;

					const token = Token.fromJson({
						symbol:transfer.quantity.split(' ')[1],
						amount:transfer.quantity.split(' ')[0],
						blockchain:Blockchains.EOSIO,
						chainId:this.network.chainId,
						contract:action.code,
					})

					return token;
				}

				return null;
			},
			fiatAmount(){
				if(!this.tokenTransfer) return;
				return this.tokenTransfer.fiatPrice(false) * parseFloat(this.tokenTransfer.amount)
			},

			transferTokens(){
				const transfers = this.messages.filter(x => x.type === 'transfer');
			}
		},
		methods:{
			accepted(){
				this.$emit('returned', {
					whitelists:this.whitelists,

					identity:this.scatter.keychain.identities[0],
					location:this.scatter.keychain.locations[0],
					missingFields:this.missingFields,

					accepted:true,
					needResources:false,
				});
			},


			hash(json){
				return Hasher.unsaltedQuickHash(JSON.stringify(json));
			},
			formatJson(json, key = null){
				this.$nextTick(() => {
					const refKey = (key ? key : '') + this.hash(json);

					const formatter = new JSONFormatter(json, 99999, {
						hoverPreviewEnabled: true,
						hoverPreviewArrayCount: 10,
						hoverPreviewFieldCount: 5,
						useToJSON: true
					});
					const elem = this.$refs[refKey][0];
					if(elem.children.length >= 1) return false;
					elem.appendChild(formatter.render());
				});
			},


			getMessageUnique(message, action){
				return `${message.code}:${message.type}:${action}`
			},
			getWhitelist(message){
				const unique = this.getMessageUnique(message, 'whitelist');
				return this.whitelists.find(x => x.unique === unique);
			},
			toggleAction(message, action){
				const unique = this.getMessageUnique(message, action);
				if(this.actionList.includes(unique)) this.actionList = this.actionList.filter(x => x !== unique);
				else this.actionList.push(unique);
			},
			getAction(message, action){
				return this.actionList.find(x => x === this.getMessageUnique(message, action))
			},
			addWhitelist(message){
				if(this.isPreviouslyWhitelisted(message)) return false;

				this.toggleAction(message, 'whitelist');
				const unique = this.getMessageUnique(message, 'whitelist');
				const whitelist = {unique, props:[], code:message.code, type:message.type, fields:message.data};

				if(this.whitelists.find(x => x.unique === whitelist.unique))
					this.whitelists = this.whitelists.filter(x => x.unique !== unique);
				else this.whitelists.push(whitelist);

				if(this.whitelists.length === 0) this.whitelisted = false;
			},
			toggleWhitelistProp(whitelist, prop){
				if(whitelist.props.includes(prop))
					whitelist.props = whitelist.props.filter(x => x !== prop);
				else whitelist.props.push(prop);
			},
			isPreviouslyWhitelisted(message){
				if(this.isArbitrarySignature) return false;
				return PermissionService.hasActionPermission(this.payload.origin, this.scatter.keychain.identities[0], this.participantAccounts, message);
			},
		},
		watch:{
			['whitelisted'](){
				if(this.whitelisted){
					this.state = STATES.Details;
				}
			}
		}
	}
</script>

<style scoped lang="scss">
	@import "../../styles/variables";

	.signature {

		label {
			font-size: $font-size-tiny;
			font-weight: bold;
			color:$grey;
		}

		.content {

			&.details {
				padding:20px;
			}





			.messages {
				width:100%;
				padding:10px 20px 20px;
				box-shadow:0 2px 10px rgba(0,0,0,0.1);
				border-radius:4px;
				overflow:auto;

				.line {
					width:calc(100% + 40px);
					margin:10px -20px;
				}

				&:not(:first-child){
					margin-top:30px;
				}

				.contract-action {

					background:$blue-gradient;
					margin:10px -20px;
					padding:20px;

					figure {
						&:first-child {
							font-size: $font-size-standard;
							color:#fff;
						}
						&:last-child {
							font-size: $font-size-large;
							font-weight: bold;
							color:#fff;
						}
					}
				}

				.properties {
					margin-top:20px;
					display:flex;
					align-items: flex-start;

					input {
						flex:0 0 auto;
						margin-right:10px;
						margin-top:7px;
						width:20px;
						height:20px;
					}

					.value {
						font-size: $font-size-medium;
						font-weight: bold;

						pre {
							max-width:calc(100vw - 140px);
							margin:0;
							overflow: auto;
							word-wrap: break-word;
							padding:10px;
							background:$softblue;
							font-size: $font-size-small;
							font-weight: 500;
							border-radius:4px;
						}
					}
				}

				&.transfer {
					.contract-action {
						background:$blue-red-gradient;
					}
				}
			}
		}

		.whitelist-this {
			display:flex;
			padding:20px;
			justify-content: space-between;
			align-items: center;
			border-top:1px solid $borderlight;

			section {
				&:last-child {
					margin-left:20px;
				}
			}

			.title {
				font-size: $font-size-standard;
			}

			.text {
				margin-top:5px;
				font-size: $font-size-small;
				color:$grey;
			}
		}
	}

	.blue-steel {
		.signature {
			.content {
				.messages {
					border:1px solid $borderdark;

					.properties {
						.value {
							pre {
								background:$black;
								color:yellow;
							}
						}
					}
				}
			}

			.whitelist-this {
				background:darken($dark, 2%);
			}
		}
	}


</style>