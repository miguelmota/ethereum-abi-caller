import React, { useEffect, useState } from 'react'
import * as ethers from 'ethers'
import abis from './abi'

const networkOptions = ['mainnet', 'kovan', 'goerli', 'rinkeby', 'ropsten']

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
  const [args, setArgs] = useState<any[]>([])
  const [result, setResult] = useState('')
  const obj = props.abi
  if (obj.type !== 'function') {
    return null
  }
  const handleSubmit = async (event: any) => {
    event.preventDefault()
    try {
      const contract = new ethers.Contract(
        props.contractAddress,
        [obj],
        props.wallet
      )
      const res = await contract.functions[obj.name](...args)
      setResult(JSON.stringify(res, null, 2))
      if (props.onSubmit) {
        props.onSubmit(res)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label style={{ marginBottom: '0.5rem' }}>
          <strong>{obj.name}</strong>
        </label>
        {obj.inputs.map((input: any, i: number) => {
          return (
            <div key={i}>
              <label>
                {input.name} ({input.type})
              </label>
              <TextInput
                value={args[i]}
                placeholder={input.type}
                onChange={(val: string) => {
                  args[i] = val
                  setArgs(args)
                }}
              />
            </div>
          )
        })}
        <button type='submit'>submit</button>
      </form>
      <pre>{result}</pre>
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
  const [rpcProvider, setRpcProvider] = useState<any>(() => {
    const net = localStorage.getItem('networkName') || 'mainnet'
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
    setRpcProvider(ethers.providers.getDefaultProvider(value))
  }
  const handlePrivateKeyChange = (value: string) => {
    setPrivateKey(value)
    localStorage.setItem('privateKey', value)
  }
  const handleContractAddressChange = (value: string) => {
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
