// Package storage keeps uploaded files on the local disk.
package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Local stores files in <dir>/restaurants. Callers choose the file names; they must be plain
// names, never paths, so a name can never reach outside that folder.
type Local struct {
	dir string
}

func NewLocal(dir string) *Local {
	return &Local{dir: dir}
}

func (store *Local) folder() string {
	return filepath.Join(store.dir, "restaurants")
}

func validName(name string) bool {
	return name != "" && name != "." && name != ".." && filepath.Base(name) == name && !strings.ContainsAny(name, `/\`)
}

// Save writes the content under name. The file appears all at once: it is written to a
// temporary file and renamed, so a failed upload never leaves half a picture.
func (store *Local) Save(name string, content io.Reader) error {
	if !validName(name) {
		return fmt.Errorf("save %q: not a plain file name", name)
	}

	if err := os.MkdirAll(store.folder(), 0o755); err != nil {
		return fmt.Errorf("create upload folder: %w", err)
	}

	temp, err := os.CreateTemp(store.folder(), ".upload-*")
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	defer os.Remove(temp.Name()) // a no-op once the rename below has succeeded

	if _, err := io.Copy(temp, content); err != nil {
		temp.Close()
		return fmt.Errorf("write %q: %w", name, err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("write %q: %w", name, err)
	}
	if err := os.Chmod(temp.Name(), 0o644); err != nil {
		return fmt.Errorf("set permissions of %q: %w", name, err)
	}

	if err := os.Rename(temp.Name(), filepath.Join(store.folder(), name)); err != nil {
		return fmt.Errorf("store %q: %w", name, err)
	}

	return nil
}

// Delete removes the file. A file that is already gone is not an error.
func (store *Local) Delete(name string) error {
	if !validName(name) {
		return fmt.Errorf("delete %q: not a plain file name", name)
	}

	if err := os.Remove(filepath.Join(store.folder(), name)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete %q: %w", name, err)
	}

	return nil
}
