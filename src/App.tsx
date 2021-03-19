import React, { useEffect, useState, SyntheticEvent } from 'react'
import * as ethers from 'ethers'
// @ts-ignore
import etherConverter from 'ether-converter'
import nativeAbis from './abi'

const networkOptions = [
  'mainnet',
  'kovan',
  'goerli',
  'rinkeby',
  'ropsten',
  'injected'
]

function getTxExplorerUrl (txHash: string, network: string) {
  const subdomain = network === 'mainnet' ? '' : `${network}.`
  return `https://${subdomain}etherscan.io/tx/${txHash}`
}

function Converter () {
  const [values, setValues] = useState<any>({})
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

  return (
    <div>
      <label>Converter</label>
      {units.map(unit => {
        let val = values[unit] ?? ''
        return (
          <div key={unit}>
            <label>{unit}</label>
            <input
              type='text'
              value={val}
              onChange={(event: any) => {
                try {
                  const value = event.target.value
                  const result = etherConverter(value, unit)
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
        gasPrice: ''
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
        <label>Custom transaction</label>
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

function AbiForm (props: any = {}) {
  const cacheKey = JSON.stringify(props.abi)
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
  const [result, setResult] = useState('')
  const [callStatic, setCallStatic] = useState<boolean>(false)
  const [txhash, setTxhash] = useState<any>(null)
  const [tx, setTx] = useState<any>(null)
  const abiObj = props.abi

  useEffect(() => {
    let tx: any = {
      gasPrice: gasPrice
        ? ethers.utils.parseUnits(gasPrice, 'gwei').toString()
        : undefined,
      gasLimit: gasLimit ? gasLimit : undefined,
      value: value ? value : undefined
    }

    try {
      if (abiObj) {
        const iface = new ethers.utils.Interface([abiObj])
        const data = iface.encodeFunctionData(abiObj.name, Object.values(args))
        tx.data = data
      }
    } catch (err) {
      // noop
    }

    setTx(tx)
  }, [abiObj, gasPrice, gasLimit, value, args])

  if (abiObj.type !== 'function') {
    return null
  }
  const handleSubmit = async (event: any) => {
    event.preventDefault()
    try {
      setTxhash(null)
      setResult('')
      const contract = new ethers.Contract(
        props.contractAddress,
        [abiObj],
        props.wallet
      )

      const txOpts = {
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        value: tx.value
      }

      const res = await contract[callStatic ? 'callStatic' : 'functions'][
        abiObj.name
      ](...Object.values(args), txOpts)
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
  const updateCallStatic = (event: any) => {
    setCallStatic(event.target.checked)
  }

  const txLink = txhash ? getTxExplorerUrl(txhash, props.network) : null
  const windowWeb3 = (window as any).ethereum

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label style={{ marginBottom: '0.5rem' }}>
          <strong>{abiObj.name}</strong>
        </label>
        {abiObj?.inputs?.map((input: any, i: number) => {
          return (
            <div key={i}>
              <label>
                {input.name} ({input.type}){' '}
                {input.type === 'address' && windowWeb3 ? (
                  <button
                    onClick={async (event: SyntheticEvent) => {
                      event.preventDefault()
                      const provider = new ethers.providers.Web3Provider(
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
              </label>
              <TextInput
                value={args[i]}
                placeholder={input.type}
                onChange={(val: string) => {
                  const newArgs = Object.assign({}, args)
                  newArgs[i] = val
                  localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                  setArgs(newArgs)
                }}
              />
            </div>
          )
        })}
        <div style={{ padding: '1rem' }}>
          <label style={{ marginBottom: '0.5rem' }}>Transaction options</label>
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
        </div>
        {tx && (
          <div>
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
      <div>
        <label>Transaction Receipt</label>
      </div>
      <form onSubmit={handleSubmit}>
        <TextInput
          value={txHash}
          onChange={handleTxHashChange}
          placeholder='Hash'
        />
        <div>
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
      <div>
        <label>Get code</label>
      </div>
      <form onSubmit={handleSubmit}>
        <TextInput
          value={address}
          onChange={handleAddressChange}
          placeholder='Address'
        />
        <div>
          <button type='submit'>get code</button>
        </div>
      </form>
      <div>
        <pre>{code}</pre>
      </div>
    </div>
  )
}

function App () {
  const [useWeb3, setUseWeb3] = useState<boolean>(() => {
    return localStorage.getItem('useWeb3') === 'true'
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
      return new ethers.providers.StaticJsonRpcProvider(
        url.replace('{network}', net)
      )
    }

    if (net === 'injected') {
      return new ethers.providers.Web3Provider((window as any).ethereum, 'any')
    }

    return ethers.providers.getDefaultProvider(net)
  })
  const [wallet, setWallet] = useState<any>(rpcProvider)
  const [contractAddress, setContractAddress] = useState(() => {
    return localStorage.getItem('contractAddress') || ''
  })
  const [newAbiName, setNewAbiName] = useState('')
  const [abiFormShown, showAbiForm] = useState(false)
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
  }, [rpcProvider])
  useEffect(() => {
    try {
      if (useWeb3) {
        if ((window as any).ethereum) {
          const provider = new ethers.providers.Web3Provider(
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
          const wal = new ethers.Wallet(priv, rpcProvider)
          setWallet(wal)
        } else {
          setWallet(null)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }, [useWeb3, privateKey, rpcProvider])
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
      const provider = new ethers.providers.JsonRpcProvider(url)
      setRpcProvider(provider)
    } else if (value === 'injected') {
      const provider = new ethers.providers.Web3Provider(
        (window as any).ethereum,
        'any'
      )
      setRpcProvider(provider)
    } else {
      setRpcProvider(ethers.providers.getDefaultProvider(value))
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
      const provider = new ethers.providers.JsonRpcProvider(
        value.replace('{network}', networkOption)
      )
      setRpcProvider(provider)
    } catch (err) {
      // noop
    }
  }
  const handleContractAddressChange = (value: string) => {
    value = value.trim()
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
    showAbiForm(true)
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
      showAbiForm(false)
      setCustomAbi('')
      setNewAbiName('')
      setSelectedAbi(name)
    } catch (err) {
      alert(err)
    }
  }
  const handleCancelAbiClick = (event: any) => {
    event.preventDefault()
    showAbiForm(false)
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
  const renderMethodForm = () => {
    try {
      const parsed = JSON.parse(abi)
      const filtered = parsed.filter((x: any) => x.name === selectedAbiMethod)
      if (!filtered.length) return null
      const obj = filtered[0]
      return (
        <AbiForm
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
  return (
    <main>
      <header>
        <h1>Ethereum ABI caller tool</h1>
      </header>
      <section>
        <Select
          onChange={handleNetworkOptionChange}
          selected={networkOption}
          options={networkOptions}
        />
        <div>network: {networkName}</div>
        <div>chain ID: {networkId}</div>
      </section>
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
      <section>
        <label>RPC provider url</label>
        <TextInput
          value={rpcProviderUrl}
          onChange={handleRpcProviderUrlChange}
        />
      </section>
      <section>
        <label>Contract address</label>
        <TextInput
          value={contractAddress}
          onChange={handleContractAddressChange}
        />
      </section>
      <section>
        <label>ABI</label>
        <div>
          {abiFormShown ? (
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
            <div>
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
        {abiFormShown ? (
          <TextInput
            value={customAbi}
            onChange={handleAbiContent}
            variant='textarea'
            placeholder='[]'
          />
        ) : (
          <div>
            <TextInput readOnly={true} value={abi} variant='textarea' />
            <div>{renderMethodSelect()}</div>
          </div>
        )}
      </section>
      {!abiFormShown ? <section>{renderMethodForm()}</section> : null}
      <section>
        <Converter />
      </section>
      <section>
        <CustomTx wallet={wallet} network={networkName} />
      </section>
      <section>
        <TxReceipt provider={rpcProvider} />
      </section>
      <section>
        <GetCode provider={rpcProvider} />
      </section>
      <footer style={{ margin: '1rem 0' }}>© 2020 Miguel Mota</footer>
    </main>
  )
}

export default App
