import React, { useEffect, useState } from 'react'
import * as ethers from 'ethers'
import abis from './abi'

const networkOptions = ['mainnet', 'kovan', 'goerli', 'rinkeby', 'ropsten']

function getTxExplorerUrl (txHash: string, network: string) {
  const subdomain = network === 'mainnet' ? '' : `${network}.`
  return `https://${subdomain}etherscan.io/tx/${txHash}`
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
        value={value}
        onChange={handleChange}
      />
    )
  } else {
    el = (
      <input
        readOnly={props.readOnly}
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
  const [args, setArgs] = useState<any>({})
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

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label style={{ marginBottom: '0.5rem' }}>
          <strong>{abiObj.name}</strong>
        </label>
        {abiObj.inputs.map((input: any, i: number) => {
          return (
            <div key={i}>
              <label>
                {input.name} ({input.type})
              </label>
              <TextInput
                value={args[i]}
                placeholder={input.type}
                onChange={(val: string) => {
                  const newArgs = Object.assign({}, args)
                  newArgs[i] = val
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

function App () {
  const [privateKey, setPrivateKey] = useState(() => {
    return localStorage.getItem('privateKey') || ''
  })
  const [networkName, setNetworkName] = useState(() => {
    return localStorage.getItem('networkName') || 'mainnet'
  })
  const [rpcProviderUrl, setRpcProviderUrl] = useState<string>(() => {
    return localStorage.getItem('rpcProviderUrl') || ''
  })
  const [rpcProvider, setRpcProvider] = useState<any>(() => {
    const net = localStorage.getItem('networkName') || 'mainnet'
    const url = localStorage.getItem('rpcProviderUrl')
    if (url) {
      return new ethers.providers.JsonRpcProvider(url.replace('{network}', net))
    }

    return ethers.providers.getDefaultProvider(net)
  })
  const [wallet, setWallet] = useState<any>(rpcProvider)
  const [contractAddress, setContractAddress] = useState(() => {
    return localStorage.getItem('contractAddress') || ''
  })
  const [selectedAbi, setSelectedAbi] = useState(() => {
    const selected = localStorage.getItem('selectedAbi')
    return selected || 'ERC20'
  })
  const [abi, setAbi] = useState(() => {
    const selected = localStorage.getItem('selectedAbi') || Object.keys(abis)[0]
    const customAbi = localStorage.getItem('customAbi') || '[]'
    if (selected === 'custom') {
      return customAbi
    }
    return (abis as any)[selected]
  })
  const [abiOptions] = useState(() => {
    return ['custom'].concat(...Object.keys(abis))
  })
  const [customAbi, setCustomAbi] = useState(() => {
    return localStorage.getItem('customAbi') || '[]'
  })
  const [selectedAbiMethod, setSelectedAbiMethod] = useState(() => {
    return localStorage.getItem('selectedAbiMethod') || 'transfer'
  })
  useEffect(() => {
    if (!privateKey) return
    try {
      const priv = privateKey.replace(/^(0x)?/, '0x')
      const wal = new ethers.Wallet(priv, rpcProvider)
      setWallet(wal)
    } catch (err) {
      console.error(err)
    }
  }, [privateKey, rpcProvider])
  useEffect(() => {
    const selected = (abis as any)[selectedAbi]
    if (selected) {
      setAbi(JSON.stringify(selected, null, 2))
    } else {
      setAbi(customAbi)
    }
  }, [selectedAbi, customAbi])
  const handleNetworkChange = (value: string) => {
    setNetworkName(value)
    localStorage.setItem('networkName', value)
    if (rpcProviderUrl) {
      let url = rpcProviderUrl.replace('{network}', value)
      const provider = new ethers.providers.JsonRpcProvider(url)
      setRpcProvider(provider)
    } else {
      setRpcProvider(ethers.providers.getDefaultProvider(value))
    }
  }
  const handlePrivateKeyChange = (value: string) => {
    setPrivateKey(value)
    localStorage.setItem('privateKey', value)
  }
  const handleRpcProviderUrlChange = (value: string) => {
    try {
      setRpcProviderUrl(value)
      localStorage.setItem('rpcProviderUrl', value)
      value = value.replace('{network}', networkName)
      const provider = new ethers.providers.JsonRpcProvider(
        value.replace('{network}', networkName)
      )
      setRpcProvider(provider)
    } catch (err) {
      // noop
    }
  }
  const handleContractAddressChange = (value: string) => {
    setContractAddress(value)
    localStorage.setItem('contractAddress', value)
  }
  const handleSelectChange = (value: string) => {
    setSelectedAbi(value)
    localStorage.setItem('selectedAbi', value)
  }
  const handleAbiContent = (value: string) => {
    setCustomAbi(value)
    localStorage.setItem('customAbi', value)
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
      <section>
        <Select
          onChange={handleNetworkChange}
          selected={networkName}
          options={networkOptions}
        />
      </section>
      <section>
        <label>Private key</label>
        <TextInput value={privateKey} onChange={handlePrivateKeyChange} />
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
        <Select
          onChange={handleSelectChange}
          selected={selectedAbi}
          options={abiOptions}
        />
        <TextInput
          readOnly={selectedAbi !== 'custom'}
          value={abi}
          onChange={handleAbiContent}
          variant='textarea'
        />
        <div>{renderMethodSelect()}</div>
      </section>
      <section>{renderMethodForm()}</section>
    </main>
  )
}

export default App
