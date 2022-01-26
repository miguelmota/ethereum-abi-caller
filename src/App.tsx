import React, { useMemo, useEffect, useState, SyntheticEvent } from 'react'
import {
  ethers,
  BigNumber,
  Contract,
  Wallet,
  Signer,
  providers,
  utils
} from 'ethers'
// @ts-ignore
import etherConverter from 'ether-converter'
import nativeAbis from './abi'
;(window as any).BigNumber = BigNumber
;(window as any).ethers = ethers

const networkOptions = [
  'mainnet',
  'kovan',
  'goerli',
  'rinkeby',
  'ropsten',
  'injected'
]

function intToHex (value: number) {
  try {
    return BigNumber.from((value || 0).toString()).toHexString()
  } catch (err) {
    return '0x'
  }
}

function getTxExplorerUrl (txHash: string, network: string) {
  const subdomain = network === 'mainnet' ? '' : `${network}.`
  return `https://${subdomain}etherscan.io/tx/${txHash}`
}

function Fieldset (props: any) {
  const { legend, children } = props
  return (
    <details open>
      <summary>
        <span className='open'>
          {legend} {'▾'}
        </span>
      </summary>
      <fieldset>
        <legend>
          {legend} <span className='close'>{'▴'}</span>
        </legend>
        {children}
      </fieldset>
    </details>
  )
}

function UnitConverter () {
  const [values, setValues] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('converter') || '') || {}
    } catch (err) {
      return {}
    }
  })
  const units = [
    'wei',
    'kwei',
    'mwei',
    'gwei',
    'szabo',
    'finney',
    'ether',
    'kether',
    'mether',
    'gether',
    'tether'
  ]
  useEffect(() => {
    try {
      localStorage.setItem('converter', JSON.stringify(values))
    } catch (err) {
      console.error(err)
    }
  }, [values])

  return (
    <div>
      {units.map((unit, i) => {
        let val = values[unit] ?? ''
        let pow = -18 + i * 3
        let exp = pow ? (
          <>
            10<sup>{pow}</sup>
          </>
        ) : (
          1
        )
        return (
          <div key={unit}>
            <label>
              {unit} ({exp})
            </label>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '100%' }}>
                <input
                  type='text'
                  value={val}
                  onChange={(event: any) => {
                    try {
                      const value = event.target.value
                      const result = etherConverter(value, unit)
                      result[unit] = value
                      if (result['wei'] === 'NaN') {
                        setValues({})
                      } else {
                        setValues(result)
                      }
                    } catch (err) {
                      console.error(err)
                    }
                  }}
                />
              </div>
              <div style={{ width: '300px', marginLeft: '1rem' }}>
                {intToHex(val)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CustomTx (props: any = {}) {
  const { wallet } = props
  const [callStatic, setCallStatic] = useState<boolean>(false)
  const [txhash, setTxhash] = useState<any>(null)
  const [result, setResult] = useState('')
  const [tx, setTx] = useState<any>(() => {
    const defaultTx = JSON.stringify(
      {
        to: '',
        value: '',
        data: '',
        gasLimit: '',
        gasPrice: '',
        nonce: ''
      },
      null,
      2
    )
    try {
      return localStorage.getItem('customTx') || defaultTx
    } catch (err) {
      return defaultTx
    }
  })
  const handleChange = (event: any) => {
    const val = event.target.value
    localStorage.setItem('customTx', val)
    setTx(val)
  }
  const updateCallStatic = (event: any) => {
    setCallStatic(event.target.checked)
  }
  const send = async () => {
    try {
      setTxhash(null)
      setResult('')
      const txData = JSON.parse(tx)
      let res: any
      if (callStatic) {
        res = await wallet.call(txData)
      } else {
        res = await wallet.sendTransaction(txData)
      }
      setTxhash(res?.hash)
      setResult(JSON.stringify(res, null, 2))
    } catch (err) {
      alert(err.message)
    }
  }

  const txLink = txhash ? getTxExplorerUrl(txhash, props.network) : null

  return (
    <div>
      <div>
        <small>Use hex values</small>
      </div>
      <textarea value={tx} onChange={handleChange} />
      <div>
        <input
          type='checkbox'
          checked={callStatic}
          onChange={updateCallStatic}
        />
        call static
      </div>
      <div>
        <button onClick={send}>send</button>
      </div>
      <pre>{result}</pre>
      {txLink && (
        <a href={txLink} target='_blank' rel='noopener noreferrer'>
          {txLink}
        </a>
      )}
    </div>
  )
}

function Select (props: any = {}) {
  const handleChange = (event: any) => {
    const value = event.target.value
    if (props.onChange) {
      props.onChange(value)
    }
  }
  return (
    <select value={props.selected} onChange={handleChange}>
      {props.options.map((option: any, i: number) => {
        return (
          <option key={i} value={option}>
            {option}
          </option>
        )
      })}
    </select>
  )
}

function TextInput (props: any = {}) {
  const [value, setValue] = useState('')
  const handleChange = (event: any) => {
    const val = event.target.value
    setValue(val)
    if (props.onChange) {
      props.onChange(val)
    }
  }
  useEffect(() => {
    setValue(props.value)
  }, [props.value])
  let el: any
  if (props.variant === 'textarea') {
    el = (
      <textarea
        readOnly={props.readOnly}
        disabled={props.disabled}
        placeholder={props.placeholder}
        value={value}
        onChange={handleChange}
      />
    )
  } else {
    el = (
      <input
        readOnly={props.readOnly}
        disabled={props.disabled}
        placeholder={props.placeholder}
        type='text'
        value={value}
        onChange={handleChange}
      />
    )
  }
  return el
}

function AbiMethodForm (props: any = {}) {
  const cacheKey = JSON.stringify(props.abi)
  const contractAddress = props.contractAddress
  const [args, setArgs] = useState<any>(() => {
    const defaultArgs: any = {}
    try {
      return JSON.parse(localStorage.getItem(cacheKey) as any) || defaultArgs
    } catch (err) {
      return defaultArgs
    }
  })
  const [gasLimit, setGasLimit] = useState<string>(() => {
    return localStorage.getItem('gasLimit') || ''
  })
  const [gasPrice, setGasPrice] = useState<string>(() => {
    return localStorage.getItem('gasPrice') || ''
  })
  const [value, setValue] = useState<string>(() => {
    return localStorage.getItem('value') || ''
  })
  const [fromAddress, setFromAddress] = useState<string>('')
  const [nonce, setNonce] = useState<string>(() => {
    return localStorage.getItem('nonce') || ''
  })
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState('')
  const [callStatic, setCallStatic] = useState<boolean>(false)
  const [txhash, setTxhash] = useState<any>(null)
  const [tx, setTx] = useState<any>(null)
  const abiObj = props.abi
  const windowWeb3 = (window as any).ethereum
  const provider = useMemo(() => {
    return new providers.Web3Provider(windowWeb3, 'any')
  }, [windowWeb3])
  useEffect(() => {
    const update = async () => {
      try {
        const address = await provider?.getSigner()?.getAddress()
        setFromAddress(address || '')
      } catch (err) {
        console.error(err)
      }
    }
    update()
  }, [provider, fromAddress, setFromAddress])

  useEffect(() => {
    let tx: any = {
      from: fromAddress ? fromAddress : undefined,
      to: contractAddress ? contractAddress : undefined,
      value: value ? value : undefined,
      gasPrice: gasPrice
        ? utils.parseUnits(gasPrice, 'gwei').toString()
        : undefined,
      gasLimit: gasLimit ? gasLimit : undefined,
      nonce: nonce ? nonce : undefined
    }

    try {
      setError('')
      if (abiObj) {
        const iface = new utils.Interface([abiObj])
        const data = iface.encodeFunctionData(abiObj.name, Object.values(args))
        tx.data = data
      }
    } catch (err) {
      setError(err.message)
    }

    setTx(tx)
  }, [
    abiObj,
    contractAddress,
    gasPrice,
    gasLimit,
    value,
    fromAddress,
    nonce,
    args
  ])

  if (abiObj.type !== 'function') {
    return null
  }
  const handleSubmit = async (event: any) => {
    event.preventDefault()
    try {
      if (error) {
        throw new Error(error)
      }
      if (!contractAddress) {
        throw new Error('contract address is required')
      }
      setTxhash(null)
      setResult('')
      const contract = new Contract(contractAddress, [abiObj], props.wallet)

      const txOpts = {
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        value: tx.value
      }

      const contractArgs = Object.values(args).reduce(
        (acc: any[], val: any, i: number) => {
          if (abiObj.inputs[i].type?.endsWith('[]')) {
            val = val.split(',').map((x: string) => x.trim())
          }
          acc.push(val)
          return acc
        },
        []
      )

      console.log('contract args:', contractArgs)
      const res = await contract[callStatic ? 'callStatic' : 'functions'][
        abiObj.name
      ](...contractArgs, txOpts)
      console.log('result:', result)
      setTxhash(res?.hash)
      setResult(JSON.stringify(res, null, 2))
      if (props.onSubmit) {
        props.onSubmit(res)
      }
    } catch (err) {
      console.error(err)
      alert(err.message)
    }
  }
  const updateGasLimit = (val: string) => {
    setGasLimit(val)
    localStorage.setItem('gasLimit', val)
  }
  const updateGasPrice = (val: string) => {
    setGasPrice(val)
    localStorage.setItem('gasPrice', val)
  }
  const updateValue = (val: string) => {
    setValue(val)
    localStorage.setItem('value', val)
  }
  const updateNonce = (val: string) => {
    setNonce(val)
    localStorage.setItem('nonce', val)
  }
  const updateCallStatic = (event: any) => {
    setCallStatic(event.target.checked)
  }

  const txLink = txhash ? getTxExplorerUrl(txhash, props.network) : null
  const stateMutability = abiObj?.stateMutability
  const methodType = abiObj?.type
  const isWritable =
    ['nonpayable', 'payable'].includes(stateMutability) &&
    methodType === 'function'

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label style={{ marginBottom: '0.5rem' }}>
          <strong>{abiObj.name}</strong>{' '}
          {stateMutability ? `(${stateMutability})` : null} (
          {isWritable ? 'writable' : 'read-only'})
        </label>
        {abiObj?.inputs?.map((input: any, i: number) => {
          const convertTextToHex = (event: SyntheticEvent) => {
            event.preventDefault()
            try {
              const newArgs = Object.assign({}, args)
              if (!utils.isHexString(args[i])) {
                newArgs[i] = utils.hexlify(Buffer.from(args[i]))
                localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                setArgs(newArgs)
              }
            } catch (err) {
              alert(err)
            }
          }
          return (
            <div key={i}>
              <label>
                {input.name} ({input.type}) *{' '}
                {input.type === 'address' && windowWeb3 ? (
                  <button
                    onClick={async (event: SyntheticEvent) => {
                      event.preventDefault()
                      const provider = new providers.Web3Provider(
                        windowWeb3,
                        'any'
                      )
                      const newArgs = Object.assign({}, args)
                      newArgs[i] = await provider?.getSigner()?.getAddress()
                      localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                      setArgs(newArgs)
                    }}
                  >
                    from web3
                  </button>
                ) : null}
                {input.type?.startsWith('bytes') ? (
                  <>
                    <span>(must be hex) </span>
                    <button onClick={convertTextToHex}>hexlify</button>
                  </>
                ) : null}
              </label>
              <TextInput
                value={args[i]}
                placeholder={input.type}
                onChange={(val: string) => {
                  val = val.trim()
                  const newArgs = Object.assign({}, args)
                  if (input.type === 'address') {
                    if (val) {
                      try {
                        val = utils.getAddress(val)
                      } catch (err) {
                        // noop
                      }
                    }
                  }
                  newArgs[i] = val
                  localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                  setArgs(newArgs)
                }}
              />
            </div>
          )
        })}
        {abiObj?.inputs.length ? <small>* = Required</small> : null}
        <div style={{ padding: '1rem' }}>
          <label style={{ marginBottom: '0.5rem' }}>
            Transaction options (optional)
          </label>
          <label>gas limit</label>
          <TextInput
            value={gasLimit}
            placeholder={'gas limit'}
            onChange={updateGasLimit}
          />
          <label>gas price (gwei)</label>
          <TextInput
            value={gasPrice}
            placeholder={'gas price'}
            onChange={updateGasPrice}
          />
          <label>value (wei)</label>
          <TextInput
            value={value}
            placeholder={'value'}
            onChange={updateValue}
          />
          <label>nonce</label>
          <TextInput
            value={nonce}
            placeholder={'nonce'}
            onChange={updateNonce}
          />
        </div>
        {abiObj?.outputs.length ? (
          <div>
            <label style={{ marginBottom: '0.5rem' }}>Return values</label>
            <ol>
              {abiObj?.outputs?.map((obj: any) => {
                return (
                  <li>
                    {obj.name} ({obj.type})
                  </li>
                )
              })}
            </ol>
          </div>
        ) : null}
        {tx && (
          <div>
            <label style={{ marginBottom: '0.5rem' }}>Transaction object</label>
            <pre>{JSON.stringify(tx, null, 2)}</pre>
          </div>
        )}
        <div>
          <input
            type='checkbox'
            checked={callStatic}
            onChange={updateCallStatic}
          />
          call static
        </div>
        <div>
          <button type='submit'>Submit</button>
        </div>
      </form>
      <pre>{result}</pre>
      {txLink && (
        <a href={txLink} target='_blank' rel='noopener noreferrer'>
          {txLink}
        </a>
      )}
    </div>
  )
}

function AbiEventForm (props: any = {}) {
  const abiObj = props.abi
  const inputs = abiObj?.inputs || []

  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>Event</div>
      <div>
        <label>
          <strong>{abiObj.name}</strong>
        </label>
      </div>
      <ol>
        {inputs.map((input: any, i: number) => {
          return (
            <li>
              <strong>{input.name}</strong> ({input.type}){' '}
              {input.indexed ? `(indexed)` : null}
            </li>
          )
        })}
      </ol>
      <div>
        <label>Signature</label>
        {abiObj.signature}
      </div>
    </div>
  )
}

function SendEth (props: any) {
  const { wallet } = props
  const [address, setAddress] = useState<string>('')
  const [balance, setBalance] = useState<string>('')
  const [amount, setAmount] = useState(localStorage.getItem('sendEthAmount'))
  const [recipient, setRecipient] = useState(
    localStorage.getItem('sendEthRecipient')
  )
  const [result, setResult] = useState<any>(null)
  useEffect(() => {
    const update = async () => {
      setAddress('')
      setBalance('')
      if (!wallet) {
        return
      }
      let signer: Signer
      if (wallet._isSigner) {
        signer = wallet
      } else if (wallet.getSigner) {
        signer = await wallet.getSigner()
      } else {
        return
      }
      try {
        const _address = await signer.getAddress()
        setAddress(_address)
        const _balance = await signer.getBalance()
        setBalance(utils.formatUnits(_balance.toString(), 18))
      } catch (err) {
        console.error(err)
      }
    }
    update()
  }, [wallet])
  useEffect(() => {
    localStorage.setItem('sendEthAmount', amount || '')
  }, [amount])
  useEffect(() => {
    localStorage.setItem('sendEthRecipient', recipient || '')
  }, [recipient])
  const handleAmountChange = (value: string) => {
    setAmount(value)
  }
  const handleRecipientChange = (value: string) => {
    setRecipient(value)
  }
  const send = async () => {
    setResult(null)
    if (!amount) {
      throw new Error('amount is required')
    }
    if (!recipient) {
      throw new Error('recipient is required')
    }
    const tx = await wallet.sendTransaction({
      to: recipient,
      value: BigNumber.from(amount)
    })
    setResult(tx)
    tx.wait((receipt: any) => {
      setResult(receipt)
    })
  }
  const handleSubmit = async (event: any) => {
    event.preventDefault()
    try {
      await send()
    } catch (err) {
      alert(err.message)
    }
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Address</label>
          <div>{address}</div>
        </div>
        <div>
          <label>Balance</label>
          <div>{balance} ETH</div>
        </div>
        <div>
          <label>Amount (uint256) *</label>
          <TextInput
            value={amount}
            onChange={handleAmountChange}
            placeholder='uint256'
          />
        </div>
        <div>
          <label>Recipient (address) *</label>
          <TextInput
            value={recipient}
            onChange={handleRecipientChange}
            placeholder='address'
          />
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>send</button>
        </div>
      </form>
      <div>
        <pre>{result ? JSON.stringify(result, null, 2) : ''}</pre>
      </div>
    </div>
  )
}

function TxReceipt (props: any) {
  const { provider } = props
  const [txHash, setTxHash] = useState(localStorage.getItem('txReceiptHash'))
  const [receipt, setReceipt] = useState(null)
  useEffect(() => {
    localStorage.setItem('txReceiptHash', txHash || '')
  }, [txHash])
  const handleTxHashChange = (value: string) => {
    setTxHash(value)
  }
  const getReceipt = async () => {
    setReceipt(null)
    const _receipt = await provider.getTransactionReceipt(txHash)
    setReceipt(_receipt)
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getReceipt()
  }
  const result = JSON.stringify(receipt, null, 2)
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Transaction hash</label>
        <TextInput
          value={txHash}
          onChange={handleTxHashChange}
          placeholder='Hash'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get receipt</button>
        </div>
      </form>
      <div>
        <pre>{result}</pre>
      </div>
    </div>
  )
}

function GetCode (props: any) {
  const { provider } = props
  const [address, setAddress] = useState(localStorage.getItem('getCodeAddress'))
  const [code, setCode] = useState(null)
  useEffect(() => {
    localStorage.setItem('getCodeAddress', address || '')
  }, [address])
  const handleAddressChange = (value: string) => {
    setAddress(value)
  }
  const getCode = async () => {
    setCode(null)
    const _code = await provider.getCode(address)
    setCode(_code)
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getCode()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Address</label>
        <TextInput
          value={address}
          onChange={handleAddressChange}
          placeholder='0x'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get code</button>
        </div>
      </form>
      <div>
        <pre>{code}</pre>
      </div>
    </div>
  )
}

function GetNonce (props: any) {
  const { provider } = props
  const [address, setAddress] = useState(
    localStorage.getItem('getNonceAddress')
  )
  const [nonce, setNonce] = useState<number | null>(null)
  useEffect(() => {
    localStorage.setItem('getNonceAddress', address || '')
  }, [address])
  const handleAddressChange = (value: string) => {
    setAddress(value)
  }
  const getNonce = async () => {
    setNonce(null)
    const _nonce = await provider.getTransactionCount(address, 'pending')
    setNonce(Number(_nonce.toString()))
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getNonce()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Address</label>
        <TextInput
          value={address}
          onChange={handleAddressChange}
          placeholder='0x'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get nonce</button>
        </div>
      </form>
      <div>
        {nonce !== null && (
          <pre>
            {nonce} ({intToHex(nonce)})
          </pre>
        )}
      </div>
    </div>
  )
}

function HexCoder (props: any) {
  const [value, setValue] = useState(
    localStorage.getItem('hexCoderValue' || '')
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('hexCoderValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const convert = () => {
    try {
      setResult(null)
      if (value?.startsWith('0x')) {
        setResult(BigNumber.from(value).toString())
      } else {
        setResult(BigNumber.from(value).toHexString())
      }
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    convert()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Hex or number</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='0x123'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>convert</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

function ClearLocalStorage () {
  const handleSubmit = (event: any) => {
    event.preventDefault()
    try {
      localStorage.clear()
      sessionStorage.clear()
      window.location.reload()
    } catch (err) {
      alert(err.message)
    }
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <button type='submit'>Clear local storage</button>
      </form>
    </div>
  )
}

function App () {
  const [useWeb3, setUseWeb3] = useState<boolean>(() => {
    const cached = localStorage.getItem('useWeb3')
    if (cached) {
      return cached === 'true'
    }
    return true
  })
  const [privateKey, setPrivateKey] = useState(() => {
    return localStorage.getItem('privateKey') || ''
  })
  const [networkName, setNetworkName] = useState('')
  const [networkId, setNetworkId] = useState('')
  const [networkOption, setNetworkOption] = useState(() => {
    return localStorage.getItem('networkOption') || 'mainnet'
  })
  const [rpcProviderUrl, setRpcProviderUrl] = useState<string>(() => {
    return localStorage.getItem('rpcProviderUrl') || ''
  })
  const [rpcProvider, setRpcProvider] = useState<any>(() => {
    const net = localStorage.getItem('networkOption') || 'mainnet'
    const url = localStorage.getItem('rpcProviderUrl')
    if (url) {
      return new providers.StaticJsonRpcProvider(url.replace('{network}', net))
    }

    if (net === 'injected') {
      return new providers.Web3Provider((window as any).ethereum, 'any')
    }

    return providers.getDefaultProvider(net)
  })
  const [wallet, setWallet] = useState<any>(rpcProvider)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [contractAddress, setContractAddress] = useState(() => {
    return localStorage.getItem('contractAddress') || ''
  })
  const [newAbiName, setNewAbiName] = useState('')
  const [abiMethodFormShown, showAbiMethodForm] = useState(false)
  const [selectedAbi, setSelectedAbi] = useState(() => {
    const selected = localStorage.getItem('selectedAbi')
    return selected || 'ERC20'
  })
  const [customAbis, setCustomAbis] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('customAbis') || '') || {}
    } catch (err) {
      return {}
    }
  })
  const [customAbi, setCustomAbi] = useState(() => {
    return localStorage.getItem('customAbi') || '[]'
  })
  const [abis, setAbis] = useState<any>(() => {
    return { ...nativeAbis, ...customAbis }
  })
  const [abi, setAbi] = useState(() => {
    const selected = localStorage.getItem('selectedAbi') || Object.keys(abis)[0]
    return (abis as any)[selected]
  })
  const [abiOptions, setAbiOptions] = useState(() => {
    return Object.keys(abis)
  })
  const [selectedAbiMethod, setSelectedAbiMethod] = useState(() => {
    return localStorage.getItem('selectedAbiMethod') || 'transfer'
  })
  const [selectedAbiEvent, setSelectedAbiEvent] = useState(() => {
    return localStorage.getItem('selectedAbiEvent') || 'Transfer'
  })
  const [connectedChainId, setConnectedChainId] = useState<string | undefined>()
  const [connectedAccounts, setConnectedAccounts] = useState<
    string[] | undefined
  >()
  useEffect(() => {
    ;(window as any).ethereum.on('chainChanged', (chainId: string) => {
      setConnectedChainId(chainId)
    })
    ;(window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
      setConnectedAccounts(accounts)
    })
  }, [])
  useEffect(() => {
    ;(window as any).provider = rpcProvider
    setNetworkName('')
    setNetworkId('')
    rpcProvider
      .getNetwork()
      .then((network: any) => {
        setNetworkName(network?.name)
        setNetworkId(network?.chainId)
      })
      .catch(() => {})
  }, [rpcProvider, connectedChainId])
  useEffect(() => {
    ;(window as any).wallet = wallet

    const updateWalletAddress = async () => {
      setWalletAddress('')
      try {
        let signer: Signer = wallet
        if (wallet.getSigner) {
          signer = await wallet.getSigner()
        }
        if (signer?.getAddress) {
          const address = await signer.getAddress()
          setWalletAddress(address)
        }
      } catch (err) {
        console.error(err)
      }
    }
    updateWalletAddress()
  }, [wallet])
  useEffect(() => {
    try {
      if (useWeb3) {
        if ((window as any).ethereum) {
          const provider = new providers.Web3Provider(
            (window as any).ethereum,
            'any'
          )
          const signer = provider.getSigner()
          setWallet(signer)
        } else {
          alert('window.web3 not found')
        }
      } else {
        if (privateKey) {
          const priv = privateKey.replace(/^(0x)?/, '0x')
          const wal = new Wallet(priv, rpcProvider)
          setWallet(wal)
        } else {
          setWallet(null)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }, [useWeb3, privateKey, rpcProvider, connectedChainId, connectedAccounts])
  useEffect(() => {
    const selected = (abis as any)[selectedAbi]
    if (selected) {
      setAbi(JSON.stringify(selected, null, 2))
    }
  }, [selectedAbi, abis])
  useEffect(() => {
    const _abis = { ...nativeAbis, ...customAbis }
    setAbis(_abis)
    setAbiOptions(Object.keys(_abis).sort())
  }, [customAbis])
  useEffect(() => {
    localStorage.setItem('selectedAbi', selectedAbi)
  }, [selectedAbi])
  const updateUseWeb3 = (event: any) => {
    const checked = event.target.checked
    localStorage.setItem('useWeb3', checked)
    setUseWeb3(checked)
  }
  const handleNetworkOptionChange = (value: string) => {
    setNetworkOption(value)
    localStorage.setItem('networkOption', value)
    if (rpcProviderUrl) {
      let url = rpcProviderUrl.replace('{network}', value)
      const provider = new providers.JsonRpcProvider(url)
      setRpcProvider(provider)
    } else if (value === 'injected') {
      const provider = new providers.Web3Provider(
        (window as any).ethereum,
        'any'
      )
      setRpcProvider(provider)
    } else {
      setRpcProvider(providers.getDefaultProvider(value))
    }
  }
  const handlePrivateKeyChange = (value: string) => {
    value = value.trim()
    setPrivateKey(value)
    localStorage.setItem('privateKey', value)
  }
  const handleRpcProviderUrlChange = (value: string) => {
    try {
      setRpcProviderUrl(value)
      localStorage.setItem('rpcProviderUrl', value)
      value = value.replace('{network}', networkOption)
      const provider = new providers.JsonRpcProvider(
        value.replace('{network}', networkOption)
      )
      setRpcProvider(provider)
    } catch (err) {
      // noop
    }
  }
  const handleContractAddressChange = (value: string) => {
    value = value.trim()
    if (value) {
      try {
        value = utils.getAddress(value)
      } catch (err) {
        // noop
      }
    }
    setContractAddress(value)
    localStorage.setItem('contractAddress', value)
  }
  const handleSelectChange = (value: string) => {
    setSelectedAbi(value)
  }
  const handleAbiContent = (value: string) => {
    setCustomAbi(value)
    localStorage.setItem('customAbi', value)
  }
  const handleAddAbiClick = (event: any) => {
    event.preventDefault()
    showAbiMethodForm(true)
    setCustomAbi('')
  }
  const handleDeleteAbiClick = (event: any) => {
    event.preventDefault()
    try {
      const _customAbis = Object.assign({}, customAbis)
      delete _customAbis[selectedAbi]
      localStorage.setItem('customAbis', JSON.stringify(_customAbis))
      setCustomAbis(_customAbis)
      setSelectedAbi(Object.keys(nativeAbis)[0])
    } catch (err) {
      alert(err)
    }
  }
  const handleSaveAbiClick = (event: any) => {
    event.preventDefault()
    try {
      if (!newAbiName) {
        throw new Error('ABI name is required')
      }
      if (!customAbi) {
        throw new Error('ABI content is required')
      }
      const name = newAbiName.trim()
      const newAbi = {
        [name]: JSON.parse(customAbi.trim())
      }
      const _customAbis = { ...customAbis, ...newAbi }
      localStorage.setItem('customAbis', JSON.stringify(_customAbis))
      setCustomAbis(_customAbis)
      showAbiMethodForm(false)
      setCustomAbi('')
      setNewAbiName('')
      setSelectedAbi(name)
    } catch (err) {
      alert(err)
    }
  }
  const handleCancelAbiClick = (event: any) => {
    event.preventDefault()
    showAbiMethodForm(false)
    setCustomAbi('')
    setNewAbiName('')
  }
  const handleNewAbiNameChange = (value: string) => {
    setNewAbiName(value)
  }

  const renderMethodSelect = () => {
    try {
      const parsed = JSON.parse(abi)
      const options = parsed
        .map((obj: any) => {
          return obj.type === 'function' ? obj.name : null
        })
        .filter((x: any) => x)
      const handleChange = (value: string) => {
        setSelectedAbiMethod(value)
        localStorage.setItem('selectedAbiMethod', value)
      }
      return (
        <Select
          onChange={handleChange}
          selected={selectedAbiMethod}
          options={options}
        />
      )
    } catch (err) {}
  }
  const renderEventsSelect = () => {
    try {
      const parsed = JSON.parse(abi)
      const options = parsed
        .map((obj: any) => {
          return obj.type === 'event' ? obj.name : null
        })
        .filter((x: any) => x)
      const handleChange = (value: string) => {
        setSelectedAbiEvent(value)
        localStorage.setItem('selectedAbiEvent', value)
      }
      if (!options.length) {
        return null
      }
      return (
        <Select
          onChange={handleChange}
          selected={selectedAbiEvent}
          options={options}
        />
      )
    } catch (err) {}
  }
  const renderMethodForm = () => {
    try {
      const parsed = JSON.parse(abi)
      const filtered = parsed.filter((x: any) => x.name === selectedAbiMethod)
      if (!filtered.length) return null
      const obj = filtered[0]
      return (
        <AbiMethodForm
          key={obj.name}
          contractAddress={contractAddress}
          wallet={wallet}
          abi={obj}
          network={networkName}
        />
      )
    } catch (err) {
      // noop
    }
  }
  const renderEventForm = () => {
    try {
      const parsed = JSON.parse(abi)
      const filtered = parsed.filter((x: any) => x.name === selectedAbiEvent)
      if (!filtered.length) return null
      const obj = filtered[0]
      return <AbiEventForm key={obj.name} abi={obj} />
    } catch (err) {
      // noop
    }
  }

  const handleConnect = async (event: any) => {
    event.preventDefault()
    try {
      const windowWeb3 = (window as any).ethereum
      if (windowWeb3 && windowWeb3.enable) {
        await windowWeb3.enable()
      }
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <main>
      <header>
        <h1>Ethereum ABI caller tool</h1>
      </header>
      <Fieldset legend='Network'>
        <section>
          <Select
            onChange={handleNetworkOptionChange}
            selected={networkOption}
            options={networkOptions}
          />
          <div>network: {networkName}</div>
          <div>chain ID: {networkId}</div>
        </section>
        <section>
          <label>RPC provider url</label>
          <TextInput
            value={rpcProviderUrl}
            onChange={handleRpcProviderUrlChange}
          />
        </section>
      </Fieldset>
      <Fieldset legend='Signer'>
        <div>
          <input type='checkbox' checked={useWeb3} onChange={updateUseWeb3} />
          use web3
        </div>
        <section>
          <label>Private key</label>
          <TextInput
            disabled={useWeb3}
            value={privateKey}
            onChange={handlePrivateKeyChange}
          />
        </section>
        {!!walletAddress && (
          <section>
            <label>Address</label>
            <div>{walletAddress}</div>
          </section>
        )}
        <section>
          <button
            onClick={handleConnect}
            disabled={!useWeb3 || !!walletAddress}
          >
            Connect Wallet
          </button>
        </section>
      </Fieldset>
      <Fieldset legend='Contract'>
        <section>
          <label>Contract address</label>
          <TextInput
            value={contractAddress}
            onChange={handleContractAddressChange}
            placeholder='0x'
          />
        </section>
      </Fieldset>
      <Fieldset legend='ABI'>
        <section>
          <div>
            {abiMethodFormShown ? (
              <div style={{ display: 'flex' }}>
                <TextInput
                  value={newAbiName}
                  onChange={handleNewAbiNameChange}
                  placeholder={'ABI name'}
                />
                <button onClick={handleSaveAbiClick}>Save</button>
                <button onClick={handleCancelAbiClick}>Cancel</button>
              </div>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <Select
                  onChange={handleSelectChange}
                  selected={selectedAbi}
                  options={abiOptions}
                />
                <button onClick={handleAddAbiClick}>Add</button>
                {!(nativeAbis as any)[selectedAbi] ? (
                  <button onClick={handleDeleteAbiClick}>Delete</button>
                ) : null}
              </div>
            )}
          </div>
          {abiMethodFormShown && (
            <TextInput
              value={customAbi}
              onChange={handleAbiContent}
              variant='textarea'
              placeholder='[]'
            />
          )}
          {!abiMethodFormShown && (
            <div>
              <TextInput readOnly={true} value={abi} variant='textarea' />
            </div>
          )}
        </section>
      </Fieldset>
      <Fieldset legend='Method'>
        {!abiMethodFormShown && (
          <div style={{ marginBottom: '1rem' }}>{renderMethodSelect()}</div>
        )}
        {!abiMethodFormShown ? <section>{renderMethodForm()}</section> : null}
      </Fieldset>
      <Fieldset legend='Event'>
        {!abiMethodFormShown && (
          <div style={{ marginBottom: '1rem' }}>{renderEventsSelect()}</div>
        )}
        {!abiMethodFormShown ? <section>{renderEventForm()}</section> : null}
      </Fieldset>
      <Fieldset legend='Send ETH'>
        <section>
          <SendEth wallet={wallet} />
        </section>
      </Fieldset>
      <Fieldset legend='Unit converter'>
        <section>
          <UnitConverter />
        </section>
      </Fieldset>
      <Fieldset legend='Custom Transaction'>
        <section>
          <CustomTx wallet={wallet} network={networkName} />
        </section>
      </Fieldset>
      <Fieldset legend='Transaction Receipt'>
        <section>
          <TxReceipt provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Get code'>
        <section>
          <GetCode provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Get nonce'>
        <section>
          <GetNonce provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Hex coder'>
        <section>
          <HexCoder />
        </section>
      </Fieldset>
      <Fieldset legend='Clear'>
        <section>
          <ClearLocalStorage />
        </section>
      </Fieldset>
      <footer style={{ margin: '1rem 0' }}>
        © 2020{' '}
        <a
          href='https://miguelmota.com'
          target='_blank'
          rel='noopener noreferrer'
        >
          Miguel Mota
        </a>
      </footer>
    </main>
  )
}

export default App
