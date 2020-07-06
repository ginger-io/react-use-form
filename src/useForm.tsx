import produce from 'immer'
import set from 'lodash.set'
import { useCallback, useMemo, useState } from 'react'
import {
  FieldDefinition,
  FieldDefinitions,
  Fields,
  FieldsState,
  FieldState
} from './types'

export type UseForm<T> = {
  fields: Fields<T> // field bindings
  validate: () => boolean // trigger validation
  getValue: () => T // retrieve the current form value
  isEmpty: boolean // true if all fields are undefined, null or ""
}

export function useForm<T extends Record<string, any>>(
  fieldDefs: FieldDefinitions<T>
): UseForm<T> {
  const initialState = useMemo(() => getInitialState(fieldDefs), [fieldDefs])
  const [state, setState] = useState<FieldsState<T>>(initialState)
  const fields = useMemo(() => createFields(state, setState), [state])
  const validate = useCallback(() => runValidation(state, setState), [state])

  const isEmpty = useMemo(() => {
    let isEmpty = true
    forEach<FieldsState<T>>(state, (_, { value }: any) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !isEmptyArray(value)
      ) {
        isEmpty = false
      }
    })

    return isEmpty
  }, [state])

  const getValue = useCallback(() => {
    return produce(state, (t) => {
      forEach<FieldState<any>>(state, (path, { value }) => {
        set(t, path, value)
      })
    }) as T
  }, [state])

  return { getValue, validate, fields, isEmpty }
}

function getInitialState<T>(fieldDefs: FieldDefinitions<T>): FieldsState<T> {
  return produce(fieldDefs, (initialState) => {
    forEach<FieldDefinition<any>>(
      fieldDefs,
      (path, { rules, default: value, __type }) => {
        set(initialState, path, { rules, value, __type })
      }
    )
  }) as FieldsState<T>
}

function createFields<T>(
  state: FieldsState<T>,
  setState: (state: FieldsState<T>) => void
): Fields<T> {
  return (produce(state, (fields) => {
    forEach<FieldState<any>>(
      state,
      (path, { value, error, touched, rules }) => {
        set(fields, path, {
          value,
          error,
          touched,
          onChange: (updatedValue: any) => {
            const updatedState = produce(state, (updatedState) => {
              set(updatedState, [...path, 'value'], updatedValue)
              set(updatedState, [...path, 'touched'], true)
            })
            setState(updatedState)
          },
          onBlur: () => {
            const updatedState = produce(state, (updatedState) => {
              const error = rules
                .map((r) => r(value))
                .find((_) => _ !== undefined)
              set(updatedState, [...path, 'error'], error)
            })
            setState(updatedState)
          }
        })
      }
    )
  }) as unknown) as Fields<T>
}

function runValidation<T>(
  state: FieldsState<T>,
  setState: (state: FieldsState<T>) => void
): boolean {
  let isValid = true
  const updatedState = produce(state, (updatedState) => {
    forEach(state, (path, field) => {
      const { rules, value } = (field as unknown) as FieldState<T>
      const error = rules.map((r) => r(value)).find((_) => _ !== undefined)
      set(updatedState, [...path, 'error'], error)
      if (error) {
        isValid = false
      }
    })
  })

  setState(updatedState)
  return isValid
}

/** Recursively calls f() for each property in object
 *  This methohd assumes "leaf" properties have been tagged with
 *  __type: "Leaf"
 */
function forEach<T>(
  object: Record<string, any>,
  f: (path: string[], value: T) => void,
  path: string[] = []
) {
  for (const key in object) {
    const field = object[key]
    const currentPath = [...path, key]

    if (field !== undefined && field.__type === 'Leaf') {
      f(currentPath, field)
    } else {
      forEach(field, f as any, currentPath)
    }
  }
}

function isEmptyArray(obj: any): boolean {
  return Array.isArray(obj) && obj.length === 0
}
