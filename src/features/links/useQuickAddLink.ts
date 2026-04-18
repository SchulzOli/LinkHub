import { useCallback, useState } from 'react'

export function useQuickAddLink(
  onSubmit: (url: string, title: string) => void,
) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  const submit = useCallback(() => {
    onSubmit(url, title)
    setUrl('')
    setTitle('')
  }, [onSubmit, title, url])

  return {
    url,
    setUrl,
    title,
    setTitle,
    submit,
  }
}
