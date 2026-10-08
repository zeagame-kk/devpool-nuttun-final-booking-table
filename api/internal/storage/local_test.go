package storage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLocal_SaveCreatesTheFolderAndWritesTheFile(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "uploads") // does not exist yet
	store := NewLocal(dir)

	require.NoError(t, store.Save("1-abc.png", strings.NewReader("image bytes")))

	got, err := os.ReadFile(filepath.Join(dir, "restaurants", "1-abc.png"))
	require.NoError(t, err)
	assert.Equal(t, "image bytes", string(got))
}

func TestLocal_SaveLeavesNoTemporaryFilesBehind(t *testing.T) {
	dir := t.TempDir()
	store := NewLocal(dir)

	require.NoError(t, store.Save("1-abc.png", strings.NewReader("x")))

	entries, err := os.ReadDir(filepath.Join(dir, "restaurants"))
	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, "1-abc.png", entries[0].Name())
}

func TestLocal_DeleteRemovesTheFileAndIsHarmlessWhenMissing(t *testing.T) {
	dir := t.TempDir()
	store := NewLocal(dir)
	require.NoError(t, store.Save("1-abc.png", strings.NewReader("x")))

	require.NoError(t, store.Delete("1-abc.png"))
	_, err := os.Stat(filepath.Join(dir, "restaurants", "1-abc.png"))
	assert.True(t, os.IsNotExist(err))

	assert.NoError(t, store.Delete("1-abc.png"), "deleting twice")
	assert.NoError(t, store.Delete("never-existed.png"))
}

func TestLocal_RefusesNamesThatEscapeTheFolder(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "uploads")
	store := NewLocal(dir)
	require.NoError(t, os.WriteFile(filepath.Join(root, "secret.txt"), []byte("keep"), 0o600))

	for _, name := range []string{"../secret.txt", "../../x.png", "a/b.png", `a\b.png`, "", ".", ".."} {
		assert.Error(t, store.Save(name, strings.NewReader("x")), "save %q", name)
		assert.Error(t, store.Delete(name), "delete %q", name)
	}

	kept, err := os.ReadFile(filepath.Join(root, "secret.txt"))
	require.NoError(t, err)
	assert.Equal(t, "keep", string(kept), "a hostile name must not touch files outside the folder")
}

func TestLocal_URLAndNameFromURLAreInverses(t *testing.T) {
	store := NewLocal(t.TempDir())

	url := store.URL("1-abc.png")

	assert.Equal(t, "/uploads/restaurants/1-abc.png", url)
	name, ok := store.NameFromURL(url)
	assert.True(t, ok)
	assert.Equal(t, "1-abc.png", name)
}

func TestLocal_NameFromURLOnlyAcceptsOurOwnPlainFileNames(t *testing.T) {
	store := NewLocal(t.TempDir())

	for _, url := range []string{
		"",
		"https://example.com/uploads/restaurants/1-abc.png",
		"/uploads/other/1-abc.png",
		"/uploads/restaurants/",
		"/uploads/restaurants/../secret",
		"/uploads/restaurants/a/b.png",
	} {
		_, ok := store.NameFromURL(url)
		assert.False(t, ok, "%q is not a file this storage serves", url)
	}
}
